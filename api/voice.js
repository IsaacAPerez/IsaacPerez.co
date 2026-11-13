'use strict';
const path = require('node:path');
const {createVoiceHandler} = require('./_lib/voice-core');
const {productionStore} = require('./_lib/voice-store');
module.exports = createVoiceHandler({site:'personal',root:path.resolve(__dirname,'..'),store:productionStore()});
