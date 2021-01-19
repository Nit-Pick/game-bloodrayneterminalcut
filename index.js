//Import some assets from Vortex we'll need.
//Required Stuff
const path = require('path');
const { actions, fs,  log, selectors, util } = require('vortex-api');
//End Required Stuff

//Parser Constants
const BRTC_INI = 'PCPODCustom.INI';
//End Parser Constants

//Game Details
const GAME_ID = 'bloodrayneterminalcut';
const STEAMAPP_ID = '1373510';
const GOGAPP_ID = '1598751450';
const GAME_NAME = 'Bloodrayne Terminal Cut';
//End Game Details

const MOD_FILE_EXT = ".POD";
const BASE_PODS = ['PCART.POD', 'PCART2.POD', 'PCMODEL.POD', 'PCSET.POD', 'PCSOUND.POD', 'STARTUP.POD', 'WORLD.POD'];

const getINIPath = (state) => {
	const gamePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
	if (!gamePath) return '';
	return path.join(gamePath, BRTC_INI);
}

function main(context) {
	//This is the main function Vortex will run when detecting the game extension.

	context.registerGame({
		id: GAME_ID,
		name: GAME_NAME,
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
		setup: (discovery) => prepareForModding(discovery, context.api.store.getState()),
		environment: {
		SteamAPPId: STEAMAPP_ID,
		},
		details: {
		steamAppId: STEAMAPP_ID,
		gogAppId: GOGAPP_ID,
		},
	});
	context.registerInstaller('bloodrayneterminalcut-mods', 25, testSupportedContent, installContent);

	let prevLoadOrder

	context.registerLoadOrderPage({
		gameId: GAME_ID,
		gameArtURL: `${__dirname}\\gameart.png`,
		preSort: (items, direction) => preSort(context.api, items, direction),
		displayCheckboxes: true,
		callback: (loadOrder) => {
			if (loadOrder === prevLoadOrder) return;
			prevLoadOrder = loadOrder;
			const state = context.api.store.getState();
			return writeLoadOrder(getINIPath(state), loadOrder.map(entry => entry.name));
		},
		createInfoPanel: () => 'Load order info goes here.'
	});
		
	return true;
}

// Preset runs on loading the page.
async function preSort(api, items, direction) {
	// Get the load order INI file.
	const state = api.store.getState();
	const gamePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
	if (!gamePath) return [];
	const iniPath = path.join(gamePath, BRTC_INI);

	// Try to read the existing INI values. 
	let iniLoadOrder = [];
	try {
		const raw = await fs.readFileasync(iniPath);
		// Chop off any lines that don't end with ".pod"
		iniLoadOrder = raw.split('\n').filter(line => !line.toLowerCase().endsWith(MOD_FILE_EXT.toLowerCase()));
	}
	catch {
		log('warn', 'Error reading INI file', iniPath, err);
	}

	// Now look at all the PODs in the game folder to compare.
	let podFiles = [];
	try {
		// List all files and folders in the game directory
		const dir = await fs.readdirAsync(gamePath);
		// Filter to only show POD files. 
		podFiles = dir.filter(file => path.extname(file).toLowerCase() === MOD_FILE_EXT.toLowerCase());
	}
	catch(err) {
		log('warn', 'Could not read POD files from game dir', err);
	}

	// Clear any entries in the INI that do not exist in the game folder.
	iniLoadOrder.filter(pod => podFiles.find(file => pod.toLowerCase() === file.toLowerCase()) !== undefined)
	// Merge in any addtional PODs using a set to ensure no duplicates.
	iniLoadOrder = new Set([...iniLoadOrder, ...podFiles]);
	iniLoadOrder = [...iniLoadOrder];

	// Add object data to each entry for display.
	const loadOrder = iniLoadOrder.map(entry => (
		{
			id: entry,
			name: entry
		}
	));

	// Return the list either asc or desc depending on the preference.
	return (direction === 'descending') ? Promise.resolve(loadOrder.reverse()) : Promise.resolve(loadOrder);
}

async function writeLoadOrder(iniPath, modPODs) {
	// Use a set to ensure there are no duplicate entries
	let loadOrder = new Set([...BASE_PODS, ...modPODs]);
	// Convert back to an array, because sets suck for this next bit.
	loadOrder = Array.from(loadOrder);
	const output = `${loadOrder.length}\n${loadOrder.join('\n')}`;
	return fs.writeFileAsync(iniPath, output)
	.catch(() => Promise.reject('Unable to write load order file.'));
}
//End Create INI

function prepareForModding(discovery, state) {
	// Create the INI if required.
	const ini = path.join(discovery.path, BRTC_INI)
	return fs.statAsync(ini)
	.then(() => Promise.resolve())
	.catch(() => writeLoadOrder(getINIPath(state), []));
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

module.exports = {
    default: main,
  };
