/*
Reference List
HuntingZoneIDs: Bluebox-1023 | Caiman-1023 | crabs-6553782 | mongos seems to be dependent on location, are the zone ids the same as orignal location?
Template IDs: Bluebox-88888888 | Caiman-99999999,99999991,99999992 | crabs-1021 | unknown for mongos | Test-mob - 181_2023

To discover more ids, hook S_SPAWN_NPC and check huntingzoneid and templateId. Or use 'mob-id-finder' module on my Github (SerenTera)

Configs are in config.json. If you do not have it, it will be auto generated on your first login
*/
'use strict'

const Command = require('command'),
	  defaultConfig = require('./lib/configDefault.json'),
	  path = require('path'),
	  fs = require('fs')	 

module.exports = function markmob(dispatch) {
	
	let	mobid=[],
		config,
		fileopen = true,
		stopwrite,
		enabled,
		active = false,
		markenabled,
		messager,
		alerts,
		Item_ID,
		Monster_ID,
		currentChannel = 0
	
	try{
		config = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'), 'utf8'))
		if(config.gameVersion !== defaultConfig.gameVersion || config.entriesVersion != defaultConfig.gameVersion && config.allowAutoEntryRemoval) {
			let oldMonsterList = JSON.parse(JSON.stringify(config.Monster_ID)), //Deep Clone to replace new list with old config using shallow merge
				newMonsterEntry = JSON.parse(JSON.stringify(defaultConfig.newEntries))

			if(config.allowAutoEntryRemoval === undefined) {
				console.log('[Monster Marker] A new config option (allowAutoEntryRemoval) is added to allow this module to automatically clear old event monster entries. It is by default enabled, and you have to disable it in config.json before next login if you do not want this.');
			}
			else if(config.allowAutoEntryRemoval) {
				for(let key of defaultConfig.deleteEntries) {	//Delete old unused entries for events that are over using deleteEntries
					if(oldMonsterList[key]) {
						console.log(`[Monster Marker] Removed old event entry: ${oldMonsterList[key]}`)  
						delete oldMonsterList[key]
					}
				}
				config.entriesVersion = defaultConfig.gameVersion
			}

				
				
			
			Object.assign(oldMonsterList,newMonsterEntry) //Remember to remove the newentries for every update as well as remove old entries from past event
			
			config = Object.assign({},defaultConfig,config,{gameVersion:defaultConfig.gameVersion,Monster_ID:oldMonsterList}) //shallow merge
			delete config.newEntries
			delete config.deleteEntries
			save(config,'config.json')
			console.log('[Monster Marker] Updated new config file. Current settings transferred over.')
		}
		configInit()
	}
	catch(e){
		config = defaultConfig
		delete config.newEntries
		delete config.deleteEntries
		config.entriesVersion = defaultConfig.gameVersion
		save(config,'config.json')
		configInit()
		console.log('[Monster Marker] New config file generated. Settings in config.json.')
	}	

	const command = Command(dispatch)

	
///////Commands
	command.add('warntoggle',() => {
		enabled=!enabled
		command.message( enabled ? '(MonsterMarker) Module Enabled' : '(MonsterMarker) Module Disabled')
		
		if(!enabled)
			for(let itemid of mobid) despawnthis(itemid)
	})
	
	command.add('warnalert',() => {
		alerts = !alerts
		command.message(alerts ? '(MonsterMarker)System popup notice enabled' : '(MonsterMarker)System popup notice disabled')
	})
	
	command.add('warnmarker',() => {
		markenabled = !markenabled
		command.message(markenabled ? '(MonsterMarker)Item Markers enabled' : '(MonsterMarker)Item Markers disabled')
	})
	
	command.add('warnclear',() => {
		command.message('(MonsterMarker)Item Markers Clear Attempted')
		for(let itemid of mobid) despawnthis(itemid)
	})

	command.add('warnactive', () => {
		command.message(`(MonsterMarker)Active status: ${active}`)
	})
	
	command.add('warnadd', (huntingZone,templateId,name) => {
		config.Monster_ID[`${huntingZone}_${templateId}`] = name
		Monster_ID[`${huntingZone}_${templateId}`] = name
		save(config,'config.json')
		command.message(`(MonsterMarker) Added Config Entry: ${huntingZone}_${templateId}= ${name}`)
	})
	
////////Dispatches
	dispatch.hook('S_SPAWN_NPC', 8, event => {	//Use version 5. Hunting zone ids are indeed only int16 types.
		if(!active || !enabled) return 
		
		if(Monster_ID[`${event.huntingZoneId}_${event.templateId}`]) { 
			if(markenabled) {
				markthis(event.loc,event.gameId.low), 			// low is enough, seems like high are all the same values anyway
				mobid.push(event.gameId.low)
			}
			
			if(alerts)notice(Monster_ID[`${event.huntingZoneId}_${event.templateId}`])
				
			if(messager) command.message('『发现BOSS』: '+ Monster_ID[`${event.huntingZoneId}_${event.templateId}`])
		}
	}) 

	dispatch.hook('S_DESPAWN_NPC', 2, event => {
		if(mobid.includes(event.gameId.low)) {
			despawnthis(event.gameId.low),
			mobid.splice(mobid.indexOf(event.gameId.low), 1)
		}
	})
	
	dispatch.hook('S_LOAD_TOPO', 3, event => { //reset mobid list on location change
		mobid=[]
		active = event.zone < 9000  //Check if it is a dungeon instance, since event mobs can come from dungeon
	})
	
	dispatch.hook('S_CURRENT_CHANNEL', 1, (event) => {
        currentChannel = event.channel;     
    });
	
////////Functions

	function markthis(locs,idRef) {
		dispatch.toClient('S_SPAWN_DROPITEM', 6, {
			gameId: {low:idRef,high:0,unsigned:true},
			loc:locs,
			item: Item_ID, 
			amount: 1,
			expiry: 300000, //expiry time,milseconds (300000=5 mins?)
			explode:false,
			masterwork:false,
			enchant:0,
			source:0,
			debug:false,
			owners: [{id: 0}]
		})
	}
	
	function despawnthis(despawnid) {
		dispatch.toClient('S_DESPAWN_DROPITEM', 4, {
			gameId: {low:despawnid,high:0,unsigned:true}
		})
	}
	
	function notice(msg) {
		dispatch.toClient('S_DUNGEON_EVENT_MESSAGE', 2, {
            type: 42,// 42 Blue Shiny Text, 31 Normal Text
            chat: 0,
            channel: 27,
            message: '发现BOSS: '+msg
        })
	
		dispatch.toClient('S_CHAT', 2, {
			channel:7,
			col:new Array("#FFCC00","#3333FF","#FFCC00","#FF0000","#FFCC00","#CC33FF"),
			cl:0,

			message:'<font color="#00ffff">『发现BOSS』: </font>'+`<font color="#ffff00">${msg}</font>`+'<font color="#00ffff">  『分流』: </font>'+`<font color="#ffff00">${currentChannel}</font>`+'<font color="#ffff00">X</font>'+'<font color="#00ffff">  『时间』: </font>'+`<font color="#ffff00">${Date().slice(16,24)}</font>`
			})
    }

	function save(data,args) {
		if(!Array.isArray(args)) args = [args] //Find a way around this later -.-
		
		if(fileopen) {
			fileopen=false
			fs.writeFile(path.join(__dirname, ...args), JSON.stringify(data,null,"\t"), err => {
				if(err) command.message('Error Writing File, attempting to rewrite')
				fileopen = true
			})
		}
		else {
			clearTimeout(stopwrite)			 //if file still being written
			stopwrite=setTimeout(save(__dirname,...args),2000)
			return
		}
	}
	
	function configInit() {
		({enabled,markenabled,messager,alerts,Item_ID,Monster_ID} = config)
	}
}

