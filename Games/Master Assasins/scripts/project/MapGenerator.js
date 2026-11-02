import { utils } from "./utils.js"
import { aabb } from "./aabb.js"
import { RoomStructures } from "./RoomStructures.js"

export class MapGenerator {
    #noiseRandomIndex
    #settings = {}
    #rooms = []

    constructor(runtime, tilemapSolid, tilemapFloor) {
        this.runtime = runtime
        this.noise = runtime.objects.AdvancedRandom.getFirstPickedInstance().objectType
        this.tilemapSolid = tilemapSolid
        this.tilemapFloor = tilemapFloor
    }

    noiseRandom(freq) {
        // 0-1
		this.#noiseRandomIndex++
        if (!freq) return this.noise.voronoi2d(this.#noiseRandomIndex * 1024, this.#settings.level * 1024)
        return this.noise.cellular2d(this.#noiseRandomIndex * freq, this.#settings.level * 256)
    }

    choose(...args) {
        const arr = []
        args.forEach(([val, count]) => {
            for (let i = 0; i < count; i++) arr.push(val)
        })
        return arr[Math.floor(Math.min(this.noiseRandom(), 0.99) * arr.length)]
    }

    #setupProperties(level) {
		const exceptions = {
			"3" : 1,
			"7" : 1,
			"9": 1,
			"10" : 2,
			"12" : 3,
			"20": 5
		}
        this.#noiseRandomIndex = !exceptions.hasOwnProperty(level) ? 0 : exceptions[level]
        this.#settings.level = level
        this.#rooms = []
		
        // The chance of smashing rooms' walls 
        this.#settings.expansionChance = {
            x: 0.1,
            y: 0.1
        }

        // The way of dividing the map 
        this.#settings.divisionType = ""
        if (level > 30) {
            if (this.noiseRandom() > 0.75) {
                this.#settings.divisionType = this.choose(["x", 1], ["y", 1], ["2x", 1], ["2y", 1])
            }
        }

        // Affect of the level for the map size
        const levelSizeInfluence = {
            width: Math.floor(Math.min((level / 50) ** 1.35 * 16, 16)),
            height: Math.floor(Math.min((level / 33) ** 1.35 * 13, 13))
        }

        const basicSize = {
            width: 16 + levelSizeInfluence.width,
            height: 19 + levelSizeInfluence.height
        }

        this.#settings.mapSize = {
            width: Math.floor(basicSize.width),
            height: Math.floor(basicSize.height)
        }
			
        this.#settings.minRoomSize = 4

        this.#settings.doorHoleTypeChances = {
            door: Math.max(10 - Math.floor(level / 50 * 4), 4),
            trap: level >= 28 ? 1 : 0,
            glass: level >= 10 ? 3 : 0,
            air: 6
        }      

		const getEnemyCountF = (level) => 1 + 4*(level/25)**0.5 + 0.5*Math.cos((level+8*Math.sin(level))/4)
		const getEnemyCountS = (level) => getEnemyCountF(25) + ((level-25)/25)**0.55 + Math.cos((level+8*Math.sin(level))/4)
		const getEnemyCountT = (level) => getEnemyCountS(50) + 2*((level-50)/50)**1.5 + Math.cos((level+8*Math.sin(level))/4)
		const getEnemyCountL = (level) => getEnemyCountT(100) + 2 * Math.sin(4*level) * Math.cos(2*level + Math.sin(level)) + 1		

        this.#settings.enemiesCount = 	level <= 25 	? 	getEnemyCountF(level) :
										level <= 50 	? 	getEnemyCountS(level) :
										level <= 100 	?   getEnemyCountT(level) :
															getEnemyCountL(level)

		this.#settings.enemiesCount = Math.floor(this.#settings.enemiesCount)
        this.#settings.defineEnemyType = () => {
            if (level < 20) return this.choose([0, 1], [1, Math.round(level / 10)])
            if (level < 40) return this.choose([0, 1], [1, 3], [2, 1 + Math.round((level - 20) / 2)], [3, 1 + Math.round((level - 20) / 16)])
            if (level < 80) return this.choose([1, 1], [2, 1 + Math.round((level - 40) / 4)], [3, 1 + Math.round((level - 40) / 2)], [4, 1 + Math.round((level - 40) / 8)])
            if (level < 100) return this.choose([2, 1 + Math.round((level - 80) / 6)], [3, 1 + Math.round((level - 80) / 4)], [4, 1 + Math.round((level - 80) / 3)])
            return this.choose([2, 1], [3, 2], [4, 3])
        }
		
		this.#settings.tileStyle = 	level >= 80 ? this.choose([1, 1], [2, 1]) :
									level >= 40 ? this.choose([1, 3], [2, 1]) :
									level >= 20 ? this.choose([0, 1], [1, 3]) : 0
									
		this.#settings.aidCount = Math.min(level > 12 ? Math.floor(this.#settings.enemiesCount / 2.5) : 0, 4)								
    }

    get mapStyle() {
        return this.#settings.tileStyle
    }
	
	get mapSize(){
		return {
			width: this.#settings.mapSize.width+1,
			height: this.#settings.mapSize.height+1,
		}
	}

    createMap(level, tilePathfindingMap) {
        this.tilePathfindingMap = tilePathfindingMap
		
		if (level>1) {
        	// Defining properties of generation
        	this.#setupProperties(level)
        	// Defining a basic structure through the BSP algorithm
        	this.#generateRooms()
        	// Making the rooms beautiful
        	this.#setupRooms()		
		}		
		else this.#createTutorialMap(level)				
    }
	
	#createTutorialMap(){
		this.#settings.tileStyle = 0
		const map = [
			["X","X","X","X","X","X","X","X","X","X"],
			["X","B","_","_","_","_","_","B","B","X"],
			["X","_","2","_","_","_","_","_","B","X"],
			["X","_","_","X","X","X","X","_","_","X"],
			["X","_","_","X","A","A","X","_","_","X"],
			["X","_","_","X","X","X","X","_","_","X"],
			["X","_","_","_","_","_","B","_","_","X"],
			["X","B","_","_","U","U","B","_","_","X"],
			["X","X","X","X","X","X","X","_","_","X"],
			["X","B","B","_","_","_","_","_","_","X"],
			["X","B","_","_","1","_","_","_","_","X"],
			["X","_","_","_","_","_","_","_","_","X"],
			["X","_","_","_","X","_","_","_","_","X"],
			["X","B","P","_","X","B","_","_","B","X"],
			["X","B","_","_","X","B","B","_","B","X"],
			["X","X","D","X","X","X","X","X","X","X"],
		]
		
		this.#settings.mapSize = {
			width: map[0].length-1,
			height: map.length-1 
		}
		
		for(let i=0; i<map.length; i++){
			for(let j=0; j<map[0].length; j++){
				const e = map[i][j]
				if(e == "X"){
					this.tilemapSolid.setTileAt(j, i, 0)
					this.tilePathfindingMap[i][j] = 1
				}
				else if (e == "_"){
					this.tilemapFloor.setTileAt(j, i, 0)
				}
				else if (e == "B"){
					this.tilemapSolid.setTileAt(j, i, 3)
					this.tilePathfindingMap[i][j] = 1
				}
				else if (e == "P"){
        			const player = this.runtime.objects.playerBase.createInstance("level_entities", j*32+16, i*32+16)
					this.tilemapFloor.setTileAt(j, i, 0)
        			player.angle = utils.d2r(270)					
				}
				else if (e == "1" || e == "2"){
					const enemy = this.runtime.objects.enemyBase.createInstance("level_entities", j*32+16, i*32+16)
					this.tilemapFloor.setTileAt(j, i, 0)
					enemy.instVars.tutorialId = Number(e)
					if(e=="2"){
						enemy.angle = utils.d2r(90)
					}
				}
				else if (e == "D"){
        			const lockedDoor = this.runtime.objects.lockedDoor.createInstance("level_walls", j*32, i*32+16)
					this.runtime.objects.glassShadow.createInstance("level_floor", lockedDoor.x, lockedDoor.y)
					this.tilemapFloor.setTileAt(j, i, 0)
				}
				
				else if (e == "U"){
					this.runtime.objects.bush.createInstance("level_walls", j*32 + 16, i*32 + 16)
					this.tilemapFloor.setTileAt(j, i, -1)
					this.tilemapSolid.setTileAt(j, i, 18)
				}
			}
		}		
	}

    #createRoom(x, y, width, height) {
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                this.tilemapFloor.setTileAt(x + j, y + i, this.#settings.tileStyle * 2)
                this.tilemapSolid.setTileAt(x + j, y, 0)
				this.tilemapFloor.setTileAt(x + j, y, -1)
                this.tilePathfindingMap[y][x + j] = 1
                this.tilemapSolid.setTileAt(x, y + i, 0)
                this.tilemapFloor.setTileAt(x, y + i, -1)
				this.tilePathfindingMap[y + i][x] = 1
            }
        }

        this.#rooms.push({
            sides: [x, y, width, height],
            doneRooms: new Set(),
            info: new Set(),
            avoidTiles: []
        })
    }

    #bsp(x, y, width, height) {
        let addC
        if (this.#settings.mapSize.width + this.#settings.mapSize.height > 50) {
            addC = this.noiseRandom() > 0.75 ?
                width < this.#settings.minRoomSize * Math.floor(2 + this.noiseRandom() * 3) ||
                height < this.#settings.minRoomSize * Math.floor(2 + this.noiseRandom() * 3) : 0
        }

        if ((width < this.#settings.minRoomSize * 2 && height < this.#settings.minRoomSize * 2) || addC) {
            this.#createRoom(x, y, width, height)
            return
        }

        let isVertical = this.noiseRandom() < 0.5
        if (height*1.25 < width) isVertical = true
        else if (width*1.25 < height) isVertical = false

        if (isVertical) {
            const split = Math.floor(this.#settings.minRoomSize + (width / 2 - this.#settings.minRoomSize) * this.noiseRandom())
            this.#bsp(x, y, split, height)
            this.#bsp(x + split, y, width - split, height)

        }
        else {
            const split = Math.floor(this.#settings.minRoomSize + (height / 2 - this.#settings.minRoomSize) * this.noiseRandom())
            this.#bsp(x, y, width, split)
            this.#bsp(x, y + split, width, height - split)
        }
    }

    #generateRooms() {
        const mapWidth = this.#settings.mapSize.width
        const mapHeight = this.#settings.mapSize.height

        const wd2 = Math.floor(mapWidth / 2)
        const hd2 = Math.floor(mapHeight / 2)
        const wd4 = Math.floor(mapWidth / 4)
        const hd4 = Math.floor(mapHeight / 4)

        if (this.#settings.mapDivisionType == "x") {
            if (this.noiseRandom() < 0.5) {
                this.#createRoom(0, 0, wd2, mapHeight)
                this.#bsp(wd2, 0, mapWidth - wd2, mapHeight)
            }
            else {
                this.#createRoom(mapWidth - wd2, 0, wd2, mapHeight)
                this.#bsp(0, 0, mapWidth - wd2, mapHeight)
            }
        }

        else if (this.#settings.mapDivisionType == "y") {
            if (this.noiseRandom() < 0.5) {
                this.#createRoom(0, 0, mapWidth, hd2)
                this.#bsp(0, hd2, mapWidth, mapHeight - hd2)
            }
            else {
                this.#createRoom(0, mapHeight - hd2, mapWidth, hd2)
                this.#bsp(0, 0, mapWidth, mapHeight - hd2)
            }
        }

        else if (this.#settings.mapDivisionType == "2x") {
            this.#createRoom(0, 0, wd4, mapHeight)
            this.#createRoom(mapWidth - wd4, 0, wd4, mapHeight)
            this.#bsp(wd4, 0, mapWidth - wd4 * 2, mapHeight)
        }

        else if (this.#settings.mapDivisionType == "2y") {
            this.#createRoom(0, 0, mapWidth, hd4)
            this.#createRoom(0, mapHeight - hd4, mapWidth, hd4)
            this.#bsp(0, hd4, mapWidth, mapHeight - hd4 * 2)
        }

        else {
            this.#bsp(0, 0, mapWidth, mapHeight)
        }

        // Borders
        for (let j = 0; j < mapWidth + 1; j++) {
            this.tilemapSolid.setTileAt(j, mapHeight, 0)
            this.tilePathfindingMap[mapHeight][j] = 1
        }

        for (let i = 0; i < mapHeight; i++) {
            this.tilemapSolid.setTileAt(mapWidth, i, 0)
            this.tilePathfindingMap[i][mapWidth] = 1
        }
    }

    #setupRooms() {
        this.#handleRoomFloorType()
        this.#handleRoomHoles()
        this.#handleRoomStructures()
        this.#handleEntitiesSpawn()
		this.#handleProps()
    }

	#handleProps(){
		// aid
		const rooms = Array.from(this.#rooms)				
		for(let i=0; i<this.#settings.aidCount; i++){
			const roomId = Math.floor(Math.min(this.noiseRandom(), 0.99)*rooms.length)
			const room = rooms[roomId]
			
			const [x, y, width, height] = room.sides

			const places = []

			for(let i=y+1; i<y+height; i++){			
				for(let j=x+1; j<x+width; j++){
					if(this.tilePathfindingMap[i][j]==0 && utils.manhattanDistance(j, i, this.entitiesInfo.player.x, this.entitiesInfo.player.y) > 3 && !this.entitiesInfo.enemies.has(`${j},${i}`)){
						const x = j*32+16
						const y = i*32+16
						places.push([x, y])
					}
				}
			}
			
			if(places.length){
				const [atX, atY] = places[Math.floor(Math.min(this.noiseRandom(), 0.99)*places.length)]
				const aid = this.runtime.objects.aid.createInstance("level_entities", atX, atY)
				const shadow = this.runtime.objects.aidShadow.createInstance("level_shadows", atX, atY)			
				aid.addChild(shadow, {transformWidth: true, transformHeight: true})
			}
			
			rooms.splice(roomId, 1)
		}
	}

    #handleEntitiesSpawn() {
		this.entitiesInfo = {player: null, enemies: new Set()}
	
        // Defining player's spawn point
        let maxRoomY = -Infinity
        this.#rooms.forEach(room => {
            if (!room.info.has("turret")) maxRoomY = maxRoomY < room.sides[1] + room.sides[3] ? room.sides[1] + room.sides[3] : maxRoomY

            // Defining average position for the future enemy position condition 
            room.averagePos = {
                x: 1 + room.sides[0] + Math.floor(room.sides[2] / 2),
                y: 1 + room.sides[1] + Math.floor(room.sides[3] / 2)
            }
        })
        const maxRoomsY = this.#rooms.filter(room => !room.info.has("turret") && room.sides[1] + room.sides[3] == maxRoomY)
        const playerRoom = maxRoomsY[Math.floor(Math.min(this.noiseRandom(), 0.99) * maxRoomsY.length)]

        const [x, y, width, height] = playerRoom.sides
        const playerSpawnPlaces = []

        for (let j = x + 1; j < x + width; j++) { 
            if (this.tilePathfindingMap[y+height-1][j] == 0) playerSpawnPlaces.push([j, y + height - 1])
			else if(this.tilePathfindingMap[y+height-2][j] == 0) playerSpawnPlaces.push([j, y + height - 2])
        }
        if (!playerSpawnPlaces.length) {
            for (let i = y + 1; i < y + height; i++) {
                for (let j = x + 1; j < x + width; j++) {
                    if (this.tilePathfindingMap[i][j] == 0) playerSpawnPlaces.push([j, i])
                }
            }
        }
        const [playerPlaceX, playerPlaceY] = playerSpawnPlaces[Math.floor(Math.min(this.noiseRandom(), 0.99) * playerSpawnPlaces.length)]
		this.entitiesInfo.player = {x: playerPlaceX, y: playerPlaceY} 

        const lockedDoorY = y + height
        this.tilemapFloor.setTileAt(playerPlaceX, lockedDoorY - 1, this.#settings.tileStyle * 2 + (playerRoom.info.has("blackFloor") ? 1 : 0))
        this.tilemapSolid.setTileAt(playerPlaceX, lockedDoorY, -1)

        // Closed door
        const lockedDoor = this.runtime.objects.lockedDoor.createInstance("level_walls", playerPlaceX * 32, lockedDoorY * 32 + 16)
        this.tilemapFloor.setTileAt(playerPlaceX, lockedDoorY, this.tilemapFloor.getTileAt(playerPlaceX, lockedDoorY - 1))
        this.tilemapSolid.setTileAt(playerPlaceX, lockedDoorY - 1, -1)
        this.tilePathfindingMap[lockedDoorY - 1][playerPlaceX] = 0
        this.runtime.objects.glassShadow.createInstance("level_floor", lockedDoor.x, lockedDoor.y)

        // Player
        const player = this.runtime.objects.playerBase.createInstance("level_entities", playerPlaceX * 32 + 16, playerPlaceY * 32 + 16)
        player.angle = utils.d2r(270)
        // Defining enemies' spawn point
        let enemiesCountToCreate = this.#settings.enemiesCount

        // Defining way points for enemies 
        const waypointCount = Math.floor(this.#rooms.length / 1.5)
        const enemyWaypointRooms = Array.from(this.#rooms)
		let createdWaypointCount = 0
        for (let i = 0; i < waypointCount; i++) {
            if (!enemyWaypointRooms.length) break
			
            const i = Math.floor(enemyWaypointRooms.length * Math.min(this.noiseRandom(), 0.99))
            const room = enemyWaypointRooms[i]

            const enemyWaypointPlaces = []
            const [x, y, width, height] = room.sides
            for (let i = y + 1; i < y + height; i++) {
                for (let j = x + 1; j < x + width; j++) {
                    if (this.tilePathfindingMap[i][j] == 0) enemyWaypointPlaces.push([j, i])
                }
            }

            const [waypointX, waypointY] = enemyWaypointPlaces[Math.floor(Math.min(this.noiseRandom(), 0.99) * enemyWaypointPlaces.length)]
            this.runtime.objects.enemyPoint.createInstance("level_entities", waypointX * 32 + 16, waypointY * 32 + 16)
			 
			createdWaypointCount++

            enemyWaypointRooms.splice(i, 1)
        }

		enemiesCountToCreate = Math.min(enemiesCountToCreate, Math.floor(createdWaypointCount*0.8))

        const enemySpawnRooms = Array.from(this.#rooms)
        while (enemySpawnRooms.length) {
            const i = Math.floor(enemySpawnRooms.length * Math.min(this.noiseRandom(), 0.99))
            const room = enemySpawnRooms[i]

            const enemySpawnPlaces = []
            const [x, y, width, height] = room.sides
            for (let i = y + 1; i <= y + height; i++) {
                for (let j = x + 1; j <= x + width; j++) {
                    if (this.tilePathfindingMap[i][j] == 0 && utils.manhattanDistance(playerPlaceX, playerPlaceY, j, i) >= 10) enemySpawnPlaces.push([j, i])
                }
            }
			
			if(enemySpawnPlaces.length){
            	const [enemyPlaceX, enemyPlaceY] = enemySpawnPlaces[Math.floor(Math.min(this.noiseRandom(), 0.99) * enemySpawnPlaces.length)]
				
            	const enemy = this.runtime.objects.enemyBase.createInstance("level_entities", enemyPlaceX * 32 + 16, enemyPlaceY * 32 + 16)
				this.entitiesInfo.enemies.add(`${enemyPlaceX},${enemyPlaceY}`)
            	enemy.instVars.id = this.#settings.defineEnemyType()			
			}
            
			enemiesCountToCreate--
            if (enemiesCountToCreate == 0) break
            enemySpawnRooms.splice(i, 1)				
        }
    }

    #handleRoomFloorType() {
        this.#rooms.forEach(room => {
            const [x, y, width, height] = room.sides

            if (width - 1 < this.#settings.minRoomSize || height - 1 < this.#settings.minRoomSize) {
                for (let i = 1; i < height; i++) {
                    for (let j = 1; j < width; j++) {
                        this.tilemapFloor.setTileAt(x + j, y + i, this.#settings.tileStyle * 2 + 1)
                    }
                }
                room.info.add("blackFloor")
            }
        })
    }

    #handleRoomHoles() {
        const arguableFloorTiles = {}
        this.#rooms.forEach((room1, i) => {
            this.#rooms.forEach(room2 => {
                if (room1 != room2 && !room1.doneRooms.has(room2) && !room2.doneRooms.has(room1)) {
                    const collision = aabb(room1.sides, room2.sides)

                    if (collision && collision.x2 - collision.x1 + collision.y2 - collision.y1 > 2) {

                        const countX = Math.floor(collision.x2 - collision.x1)
                        const countY = Math.floor(collision.y2 - collision.y1)

                        const c1 = countX && this.noiseRandom() < this.#settings.expansionChance.y
                        const c2 = countY && this.noiseRandom() < this.#settings.expansionChance.x

                        if (c1) {
                            for (let j = 0; j < countX - 1; j++) {
                                const x = collision.x1 + j + 1
                                const y = collision.y1
                                room1.avoidTiles.push([x, y])
                                room2.avoidTiles.push([x, y])
                                this.tilemapFloor.setTileAt(x, y, this.#settings.tileStyle * 2)
                                this.tilemapSolid.setTileAt(x, y, -1)
                                this.tilePathfindingMap[y][x] = 0
                            }
                        }

                        else if (c2) {
                            for (let i = 0; i < countY - 1; i++) {
                                const x = collision.x1
                                const y = collision.y1 + i + 1
                                room1.avoidTiles.push([x, y])
                                room2.avoidTiles.push([x, y])
                                this.tilemapFloor.setTileAt(x, y, this.#settings.tileStyle * 2)
                                this.tilemapSolid.setTileAt(x, y, -1)
                                this.tilePathfindingMap[y][x] = 0
                            }
                        }

                        if (c1 || c2) {
                            this.#extendFloor(room1)
                            this.#extendFloor(room2)
                        }

                        if (!c1 && !c2) {
                            const x = collision.x1 + (collision.x1 != collision.x2 ?
                                Math.max(Math.floor((collision.x2 - collision.x1 - 1) * Math.min(this.noiseRandom(), 0.99)), 2) : 0)
                            const y = collision.y1 + (collision.y1 != collision.y2 ?
                                Math.max(Math.floor((collision.y2 - collision.y1 - 1) * Math.min(this.noiseRandom(), 0.99)), 2) : 0)

                            room1.avoidTiles.push([x, y])
                            room2.avoidTiles.push([x, y])
                            this.tilemapSolid.setTileAt(x, y, -1)
                            this.tilePathfindingMap[y][x] = 0
                            if (!arguableFloorTiles[i]) arguableFloorTiles[i] = []
                            arguableFloorTiles[i].push([x, y])
                        }

                        room1.doneRooms.add(room2)
                    }
                }
            })
        })

        for (const roomI in arguableFloorTiles) {
            const arr = arguableFloorTiles[roomI]
            const preventGlassAtI = Math.floor(Math.min(this.noiseRandom(), 0.99) * arr.length)
            let i = 0
            arr.forEach(([x, y]) => {

                const tilesAround = [
                    this.tilemapFloor.getTileAt(x, y - 1),
                    this.tilemapFloor.getTileAt(x, y + 1),
                    this.tilemapFloor.getTileAt(x - 1, y),
                    this.tilemapFloor.getTileAt(x + 1, y)
                ]

                this.tilemapFloor.setTileAt(x, y, Math.max(...tilesAround))

                const type = this.choose(
                    [0, this.#settings.doorHoleTypeChances.door],
                    [1, this.#settings.doorHoleTypeChances.trap],
                    [2, this.#settings.doorHoleTypeChances.glass * i == preventGlassAtI ? 0 : 1],
                    [3, this.#settings.doorHoleTypeChances.air]
                )

                const atX = x * 32
                const atY = y * 32

                if (type == 0) {
                    const door = this.runtime.objects.door.createInstance("level_walls", atX, atY + 16)
                    const shadow = this.runtime.objects.glassShadow.createInstance("level_floor", door.x, door.y)

                    if (this.tilemapSolid.getTileAt(x, y + 1) != -1) {
                        door.angle += 90 * Math.PI / 180
                        door.y -= 16
                        door.x += 16
                    }
                    shadow.angle = door.angle
                    shadow.x = door.x
                    shadow.y = door.y
                    door.addChild(shadow, { transformWidth: true })

                    door.instVars.cx = door.getImagePointX("cx")
                    door.instVars.cy = door.getImagePointY("cy")
                }

                else if (type == 1) {
                    const laser = this.runtime.objects.laser.createInstance("level_floor+", atX + 16, atY + 16)

                    if (this.tilemapSolid.getTileAt(x, y + 1) != -1) {
                        laser.angle += 90 * Math.PI / 180
                    }
                }

                else if (type == 2) {
                    this.tilePathfindingMap[y][x] = 3
                    const glass = this.runtime.objects.glass.createInstance("level_walls", atX + 16, atY + 16)
                    const shadow = this.runtime.objects.glassShadow.createInstance("level_floor", glass.x, glass.y)

                    shadow.x = glass.x - 16
                    shadow.y = glass.y
                    if (this.tilemapSolid.getTileAt(x, y + 1) != -1) {
                        glass.angle += 90 * Math.PI / 180
                        shadow.y -= 16
                        shadow.x += 16
                    }
                    shadow.angle = glass.angle
                    glass.addChild(shadow, { destroyWithParent: true })
                }

                i++
            })
        }
    }

    #extendFloor(room) {
        room.info.delete("blackFloor")
        for (let i = 1; i < room.sides[3]; i++) {
            const atY = room.sides[1] + i
            for (let j = 1; j < room.sides[2]; j++) {
                const atX = room.sides[0] + j
				if(this.tilemapFloor.getTileAt(atX, atY) != -1) this.tilemapFloor.setTileAt(atX, atY, this.#settings.tileStyle * 2)
            }
        }
    }

    #handleRoomStructures() {
		const boxTile = this.#settings.tileStyle*6 + 3
		this.#rooms.forEach(room => {
            const fn = new RoomStructures(this, room)

            const propTypes = fn.types.filter((type, i) => i != 0 && type.check())

            if (propTypes.length) {
                const prop = propTypes[Math.floor(propTypes.length * Math.min(this.noiseRandom(), 0.99))]
                prop.build()

                if (prop.boxesPossible && this.noiseRandom() < 0.5) fn.types[0].build()
                if (prop.isTurret) room.info.add("turret")
            }
            else {
                if (fn.types[0].check()) fn.types[0].build()
            }

            const [x, y, width, height] = room.sides
			
			const boxFix = (x, y) => {
                if (this.tilemapSolid.getTileAt(x, y) == -1) {
                    const tileAt = this.tilemapSolid.getTileAt.bind(this.tilemapSolid)
                    
                    const [isTop, isBottom, isLeft, isRight] = [
                        tileAt(x, y - 1) == boxTile,
                        tileAt(x, y + 1) == boxTile,
                        tileAt(x - 1, y) == boxTile,
                        tileAt(x + 1, y) == boxTile
                    ]
    
                    if (
                        (isRight && isBottom && !isLeft && !isTop) ||
                        (isLeft && isBottom && !isRight && !isTop) ||
                        (isRight && isTop && !isBottom && !isLeft) ||
                        (isLeft && isTop && !isRight && !isBottom)
    
                    ) {
                        this.tilemapSolid.setTileAt(x, y, boxTile)
						this.tilemapFloor.setTileAt(x, y, -1)
                        this.tilePathfindingMap[y][x] = 1
                    }
                }
			}
			
			for(let i=y+1; i<y+height; i++){
				boxFix(x+1, i)
                boxFix(x+width-1, i)
			}

            for(let j=x+1; j<x+width; j++){
				boxFix(j, y+1)
                boxFix(j, y+height-1)
			}
        })
    }
}	