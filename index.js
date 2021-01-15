//Import some assets from Vortex we'll need.
const path = require('path');
const { actions, fs, DraggableList, FlexLayout, MainPage, log, selectors, util } = require('vortex-api');
const winapi = require('winapi-bindings');
const React = require('react');
const BS = require('react-bootstrap');

const { connect } = require('react-redux');

const GAME_ID = 'bloodrayneterminalcut';
const STEAMAPP_ID = '1373510';
const GOGAPP_ID = '1598751450';

const MOD_FILE_EXT = ".zip";

const I18N_NAMESPACE = `game-${GAME_ID}`;

function main(context) {
	//This is the main function Vortex will run when detecting the game extension.
	context.registerGame({
		id: GAME_ID,
		name: 'Bloodrayne Terminal Cut',
		mergeMods: true,
		queryPath: findGame,
		supportedTools: [],
		queryModPath: () => '',
		logo: 'gameart.png',
		executable: () => 'rayne1.exe',
		requiredFiles: [
		'STARTUP.POD',
		'rayne1.exe'
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: STEAMAPP_ID,
      gogAppId: GOGAPP_ID,
    },
});
context.registerInstaller('bloodrayneterminalcut-mods', 25, testSupportedContent, installContent);
	
context.registerMainPage('sort-none', 'Load Order', LoadOrder, {
	id: 'bloodrayneterminalcut-load-order',
	hotkey: 'E',
	group: 'per-game',
	visible: () => selectors.activeGameId(context.api.store.getState()) === GAME_ID,
	props: () => ({
		t: context.api.translate,
	}),
});	
	return true;
}

function loadOrderPrefix(api, mod) {
	const state = api.store.getState();
	const gameProfile = selectors.lastActiveProfileForGame(state, GAME_ID);
	if (gameProfile === undefined) {
		return 'ZZZZ-';
	}
	const profile = selectors.profileById(state, gameProfile);
	const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile?.id], []);
	
	const pos = loadOrder.indexOf(mod.id);
	if (pos === -1) {
		return 'ZZZZ-';
	}
	return makePrefix(pos) + '-';
}


function modIsEnabled(props, mod) {
	return (!!props.modState[mod])
	? props.modState[mod].enabled
	: false;
}

function LoadOrderBase(props) {
	const loValue = (input) => {
		const idx = props.order.indexOf(input);
		return idx !== -1 ? idx : props.order.length;
	}
	const filtered = Object.keys(props.mods).filter(mod => modIsEnabled(props, mod));
	const sorted = filtered.sort((lhs, rhs) => loValue(lhs) - loValue(rhs));
	
	class ItemRenderer extends React.Component {
		render() {
			const item = this.props.item;
			const index = (props.order.indexOf(item) === -1)
			? loadOrderPrefix(_API, item)
			: props.order.indexOf(item);
			
			return !modIsEnabled(props, item)
			? null
			: React.createElement(BS.ListGroupItem, {
				style: {
					backgroundColor: 'var(--brand-bg, black)',
					borderBottom: '2px solid var(--border-color, white)'
				},
			},
			React.createElement('div', {
				style: {
					fontSize: '1.1em',
				},
			},
			React.createElement('img', {
				src: props.mods[item].attributes.pictureUrl
				? props.mods[item].attributes.pictureUrl
				: `${__dirname}/gameart.jpg`,
				className: 'mod-picture',
				width:'75px',
				height:'45px',
				style: {
					margin: '5px 10px 5px 5px',
					border: '1px solid var(--brand-secondary,#D78F46)',
				},
			}),
			util.renderModName(props.mods[item])));
		}
	}
	return React.createElement(MainPage, {},
	React.createElement(MainPage.Body, {},
	React.createElement(BS.Panel, { id: 'bloodrayneterminalcut-loadorder-panel' },
	React.createElement(BS.Panel.Body, {},
	React.createElement(FlexLayout, { type: 'row' },
	React.createElement(FlexLayout.Flex, {},
	React.createElement(DraggableList, {
		id: 'bloodrayneterminalcut-loadorder',
		itemTypeId: 'bloodrayneterminalcut-loadorder-item',
		items: sorted,
		itemRenderer: ItemRenderer,
		style: {
			height: '100%',
			overflow: 'auto',
			borderWidth: 'var(--border-width, 1px)',
			borderStyle: 'solid',
			borderColor: 'var(--border-color, white)',
		},
		apply: ordered => {
			props.onSedDeploymentNecessary(props.profile.gameId, true);
			return props.onSetOrder(props.profile.id, ordered)
		},
	})
	),
	React.createElement(FlexLayout.Flex, {},
	React.createElement('div', {
		style: {
			padding: 'var(--half-gutter, 15px)',
		}
	},
	React.createElement('h2', {},
	props.t('Changing your load order', { ns: I18N_NAMESPACE })),
	React.createElement('p', {},
	props.t('Drag and drop the mods on the left to reorder them. Bloodrayne Terminal Cut loads mods in decending order so Vortex prefixes '
	+ 'the directory names with "AAA, AAB, AAC, ..." to ensure they load in the order you set here. '
	+ 'Mods placed at the top of the load order will have priority over those below them.', { ns: I18N_NAMESPACE })),
	React.createElement('p', {}, 
	props.t('Note: You can only manage mods installed with Vortex. Installing other mods manually may cause unexpected errors.', { ns: I18N_NAMESPACE })),
	))
	)))));
}

function findGame() {
	try {
		const instPath = winapi.RegGetValue(
		'HKEY_LOCAL_MACHINE',
		'SOFTWARE\\WOW6432Node\\GOG.com\\Games\\' + GOGAPP_ID,
		'PATH');
		if (!instPath) {
			throw new Error('empty registry key');
		}
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID, GOGAPP_ID])
      .then(game => game.gamePath);
  }
}

function prepareForModding(discovery) {
    let gamePath = path.join(discovery.path)
    GAME_PATH = gamePath;
    return fs.ensureDirWritableAsync(gamePath, () => Promise.resolve());
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  let supported = (gameId === GAME_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent(files) {
  // The .pak file is expected to always be positioned in the mods directory we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  
  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function mapStateToProps(state) {
	const profile = selectors.activeProfile(state);
	return {
		profile,
		modState: util.getSafe(profile, ['modState'], {}),
		mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], []),
		order: util.getSafe(state, ['persistent', 'loadOrder', profile.id], []),
	};
}

function mapDispatchToProps(dispatch) {
	return {
		onSedDeploymentNecessary: (gameId, necessary) => dispatch(actions.setDeploymentNecessary(gameId, necessary)),
		onSetOrder: (profileId, ordered) => dispatch(actions.setLoadOrder(profileId, ordered)),
	};
}

const LoadOrder = connect(mapStateToProps, mapDispatchToProps)(LoadOrderBase);

module.exports = {
    default: main,
  };