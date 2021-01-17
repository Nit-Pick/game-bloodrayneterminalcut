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
		
	return true;
}



//Create INI
function onGameModeActivated(gameId, api) {
    // Exit if we aren't managing Fallout 76
    if (gameId !== GAME_ID) return;
    const state = api.store.getState()
    const gamePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined);
    
    if (!gamePath) throw new Error('Unable to find game path');
    const ini = path.join(gamePath, BRTC_INI);

    // Make sure the folder in My Documents exists, create it if not. 
    return fs.statAsync(ini)
    .then(() => {
        // Our INI exists, so we can do stuff with it.
        })
    .catch((err) => {
        // INI may not exist. 
      });

}

function writeLoadOrder(iniPath, modPODs) {
	// Use a set to ensure there are no duplicate entries
	let loadOrder = new Set([...BASE_PODS, ...modPODs]);
	// Convert back to an array, because sets suck for this next bit.
	loadOrder = Array.from(loadOrder);
	const output = `${loadOrder.length}\n${loadOrder.join('\n')}`;
	fs.writeFile(iniPath, output);
}
//End Create INI

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

module.exports = {
    default: main,
  };