import { roulette } from "./shopRoulette.js"
import { TilePathfinding } from "./TilePathfinding.js"
import { createPathLines, destroyPathLines } from "./createPathLines.js"
import { utils } from "./utils.js"
import { MapGenerator } from "./MapGenerator.js"

let tilePathfinding = null
let player = null
let tilemapSolid, tilemapFloor

let mapGenerator

const playerWalkableTiles = [0, 2, 3]
const enemyWalkableTiles = [0, 2]

const tileCosts = {
    "2": 50
}

const defineSkinPrices = () => {
    const arr = []
    let [c, o] = [0, 0]
    
    for (let i = 1; i <= 100; i++) {
        c += 0.8 * (1 + (i / 100) ** 0.55 * 13 * 10)
        if (i % 15 == 0) {
            arr.push(utils.round(c-o, 50))
            o = c
        }
    }
    return arr
}

const skinPrices = defineSkinPrices()


const resolveInstanceWallCollision = (instance, walkableTiles) => {
    const walls = []
    const tx = Math.floor(instance.x / tilePathfinding.cellSize) * tilePathfinding.cellSize + tilePathfinding.cellSize / 2
    const ty = Math.floor(instance.y / tilePathfinding.cellSize) * tilePathfinding.cellSize + tilePathfinding.cellSize / 2
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (!(i == 0 && j == 0) && !tilePathfinding.isWalkableTile(tilePathfinding.inCell(instance.x) + j, tilePathfinding.inCell(instance.y) + i, walkableTiles)) {
                const x = Math.floor(tx + j * tilePathfinding.cellSize)
                const y = Math.floor(ty + i * tilePathfinding.cellSize)
                walls.push({
                    x: x,
                    y: y,
                })
            }
        }
    }

    walls.forEach((wall) => {
        const collision = tilePathfinding.defineCollision(instance, wall, 28)

        if (collision) {
            instance.x -= collision.strX * 4
            instance.y -= collision.strY * 4
        }
    })
}


const defineEnemyLayeredTiles = (runtime, enemy) => {
    const layeredTiles = new Set()
    runtime.objects.enemyBase.getAllInstances().forEach((pickedEnemy) => {
        if (enemy != pickedEnemy && utils.distance(enemy.x, enemy.y, pickedEnemy.x, pickedEnemy.y) < 128) {
            layeredTiles.add(`${tilePathfinding.inCell(pickedEnemy.x)},${tilePathfinding.inCell(pickedEnemy.y)}`)
        }
    })
    return layeredTiles
}

const defineEnemyPathFromPoint = (runtime, enemy, afterResolvingCollision) => {
    if (!enemy.behaviors.Timer.isTimerRunning("patrolingBreak")) {
        const points = runtime.objects.enemyPoint.getAllInstances().filter((point) => point.instVars.isUsing == 0 && point.uid != enemy.instVars.prevPointUID)
        const point = points[Math.floor(Math.random() * points.length)]

        if (point) {
            if (afterResolvingCollision) makePrevEnemyPointNotUsing(enemy)

            enemy.instVars.goalX = point.x
            enemy.instVars.goalY = point.y
            const pathFound = tilePathfinding.defineInstancePath(enemy, enemy.instVars.goalX, enemy.instVars.goalY, enemyWalkableTiles, defineEnemyLayeredTiles(runtime, enemy), tileCosts, 1)
            if (pathFound) {
                enemy.instVars.prevPointUID = point.uid
                enemy.addChild(point)
                point.instVars.isUsing = 1
            }
        }
    }
}

const getEnemyPoint = (enemy) => {
    for (let i = 0; i < enemy.getChildCount(); i++) {
        const child = enemy.getChildAt(i)
        if (child.objectType.name == "enemyPoint") {
            return child
        }
    }
}

const destroyEnemySign = (enemy) => {
    for (let i = 0; i < enemy.getChildCount(); i++) {
        const child = enemy.getChildAt(i)
        if (child.objectType.name == "enemy_sign") {
            child.destroy()
            break
        }
    }
}

const makePrevEnemyPointNotUsing = (enemy) => {
    for (const child of enemy.children()) {
        if (child.objectType.name == "enemyPoint") {
            child.instVars.isUsing = 0
            enemy.removeChild(child)
            break
        }
    }
}

const setPursuingEnemyState = (runtime, enemy) => {
    makePrevEnemyPointNotUsing(enemy)
    destroyEnemySign(enemy)
    enemy.behaviors.Timer.stopTimer("pursuingEnd")
    enemy.instVars.state = "pursuing"
    tilePathfinding.stopMoveInstance(enemy)
    const sign = runtime.objects.enemy_sign.createInstance("level_up", enemy.x + 20, enemy.y - 20)
    enemy.addChild(sign, { transformX: true, transformY: true })
    sign.animationFrame = 1
    runtime.callFunction('animateEnemySign', sign.uid, 0)
}

const setSuspiciousEnemyState = (runtime, enemy, goalX, goalY, enDist) => {
    if (enemy.instVars.state != "pursuing") {
        makePrevEnemyPointNotUsing(enemy)
        destroyEnemySign(enemy)
        enemy.instVars.state = "suspicious"
        tilePathfinding.stopMoveInstance(enemy)
        const sign = runtime.objects.enemy_sign.createInstance("level_up", enemy.x + 20, enemy.y - 20)
        enemy.addChild(sign, { transformX: true, transformY: true })
        runtime.callFunction('animateEnemySign', sign.uid, runtime.globalVars.enemy_suspiciousStartBreakTime)
        enemy.instVars.goalX = goalX
        enemy.instVars.goalY = goalY
        enemy.instVars.enDist = enDist
        enemy.behaviors.Timer.stopTimer("patrolingBreak")
        enemy.behaviors.Timer.stopTimer("calcInterval")
        enemy.behaviors.Timer.stopTimer("susEndBreak")
        enemy.instVars.tP_maxSpeed = enemy.instVars.baseMaxSpeed * runtime.globalVars.enemy_maxSpeedMultiplier
        enemy.behaviors.Timer.startTimer(runtime.globalVars.enemy_suspiciousStartBreakTime, "susStartBreak")
    }
}

const scriptsInEvents = {

	async Es_game_Event7_Act17(runtime, localVars)
	{
		tilemapSolid = runtime.objects.TilemapSolid.getFirstPickedInstance()
		tilemapFloor = runtime.objects.TilemapFloor.getFirstPickedInstance()
		mapGenerator = new MapGenerator(runtime, tilemapSolid, tilemapFloor)
	},

	async Es_game_Event21(runtime, localVars)
	{
		tilePathfinding = new TilePathfinding(tilemapSolid.mapDisplayWidth, tilemapSolid.mapDisplayHeight, tilemapSolid.tileWidth, C3)
		
		mapGenerator.createMap(runtime.globalVars.currentLevel, tilePathfinding.map)
	},

	async Es_game_Event23_Act2(runtime, localVars)
	{
		localVars.wallStyle = mapGenerator.mapStyle*6
		localVars.floorStyle = mapGenerator.mapStyle*2
		runtime.globalVars.mapWidth = mapGenerator.mapSize.width
		runtime.globalVars.mapHeight = mapGenerator.mapSize.height
	},

	async Es_game_Event115_Act5(runtime, localVars)
	{
		player = runtime.objects.playerBase.getFirstPickedInstance()
	},

	async Es_game_Event144_Act4(runtime, localVars)
	{
		runtime.objects.enemyBase.getAllInstances().forEach((enemy) => {
			setSuspiciousEnemyState(runtime, enemy, player.x, player.y, 128)
		})
	},

	async Es_game_Event172_Act1(runtime, localVars)
	{
		const glass = runtime.objects.glass.getFirstPickedInstance()
		tilePathfinding.map[tilePathfinding.inCell(glass.y)][tilePathfinding.inCell(glass.x)] = 0
		
		runtime.objects.enemyBase.getAllInstances().forEach((enemy) => {
			if(C3.distanceTo(enemy.x, enemy.y, glass.x, glass.y) < enemy.instVars.susDistance){
				setSuspiciousEnemyState(runtime, enemy, glass.x, glass.y, 128)
			}
		})
	},

	async Es_game_Event173_Act1(runtime, localVars)
	{
		const glass = runtime.objects.glass.getFirstPickedInstance()
		tilePathfinding.map[tilePathfinding.inCell(glass.y)][tilePathfinding.inCell(glass.x)] = 0
	},

	async Es_game_Event176_Act1(runtime, localVars)
	{
		const aid = runtime.objects.aid.getFirstPickedInstance()
		runtime.objects.enemyBase.getAllInstances().forEach((enemy) => {
			if(C3.distanceTo(enemy.x, enemy.y, aid.x, aid.y) < enemy.instVars.susDistance){
				setSuspiciousEnemyState(runtime, enemy, aid.x, aid.y, 128)
			}
		})
	},

	async Es_game_Event215(runtime, localVars)
	{
		const cellTouchX = tilePathfinding.inCell(localVars.touchX)
		const cellTouchY = tilePathfinding.inCell(localVars.touchY)
		
		if ((cellTouchX != tilePathfinding.inCell(player.x) || cellTouchY != tilePathfinding.inCell(player.y)) && localVars.prevCellTouchX != cellTouchX || localVars.prevCellTouchY != cellTouchY) {
			const isDefined = tilePathfinding.defineInstancePath(player, localVars.touchX, localVars.touchY, playerWalkableTiles)
		    localVars.prevCellTouchX = cellTouchX
		    localVars.prevCellTouchY = cellTouchY
			
			runtime.globalVars.player_followingEnemyUID = 0
			runtime.objects.enemyTarget.getFirstPickedInstance()?.destroy()
			
			if(isDefined) setTimeout(() => createPathLines(runtime, player), 0)
		}
	},

	async Es_game_Event218(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		tilePathfinding.defineInstancePath(player, enemy.x, enemy.y, playerWalkableTiles, false, false, 1.4)
		createPathLines(runtime, player)
	},

	async Es_game_Event219_Act1(runtime, localVars)
	{
		destroyPathLines(runtime)
	},

	async Es_game_Event220(runtime, localVars)
	{
		tilePathfinding.updateInstance(player, runtime.dt)
		if(player.instVars.tP_isMoving) player.angle = C3.angleLerp(player.angle, player.instVars.tP_movingAngle, 0.3*runtime.globalVars.dt60)
		
		// collision resolving: player - wall
		resolveInstanceWallCollision(player, playerWalkableTiles)
	},

	async Es_game_Event237_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		
		runtime.objects.enemyBase.getAllInstances().forEach((enemy2) => {
			if(enemy != enemy2 && enemy2.instVars.tP_state != "pursuing" && C3.distanceTo(enemy2.x, enemy2.y, enemy.x, enemy.y) < runtime.globalVars.enemy_pursuingPropagateRange){
				setPursuingEnemyState(runtime, enemy2)
			}
		})
	},

	async Es_game_Event240_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		enemy.instVars.state = "patroling"
		enemy.instVars.tP_maxSpeed = enemy.instVars.baseMaxSpeed
		enemy.behaviors.Timer.stopTimer("calcInterval")
	},

	async Es_game_Event241_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		enemy.instVars.state = "patroling"
		enemy.instVars.tP_maxSpeed = enemy.instVars.baseMaxSpeed
		enemy.behaviors.Timer.stopTimer("calcInterval")
		tilePathfinding.stopMoveInstance(enemy)
	},

	async Es_game_Event258_Act1(runtime, localVars)
	{
		const glass = runtime.objects.glass.getFirstPickedInstance()
		tilePathfinding.map[tilePathfinding.inCell(glass.y)][tilePathfinding.inCell(glass.x)] = 0
	},

	async Es_game_Event276(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		
		if(enemy.instVars.tP_isMoving == 0) defineEnemyPathFromPoint(runtime, enemy, 0)
	},

	async Es_game_Event278(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		
		if (!enemy.behaviors.Timer.isTimerRunning("susStartBreak") && !enemy.behaviors.Timer.isTimerRunning("calcInterval")) {
			if(enemy.instVars.enDist && utils.manhattanDistance(enemy.x, enemy.y, enemy.instVars.goalX, enemy.instVars.goalY) < enemy.instVars.enDist) {
				enemy.instVars.tP_arrived = 1
		        enemy.instVars.tP_isMoving = 0
			}
			else{
		    	tilePathfinding.defineInstancePath(enemy, enemy.instVars.goalX, enemy.instVars.goalY, enemyWalkableTiles, defineEnemyLayeredTiles(runtime, enemy), tileCosts, 1)
				enemy.behaviors.Timer.startTimer(0.5, "calcInterval")	
			}
		}
	},

	async Es_game_Event284_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		
		if (!enemy.behaviors.Timer.isTimerRunning("calcInterval")) {
		    tilePathfinding.defineInstancePath(enemy, player.x, player.y, enemyWalkableTiles, defineEnemyLayeredTiles(runtime, enemy), false, 1)
			enemy.behaviors.Timer.startTimer(0.5, "calcInterval")
		}
	},

	async Es_game_Event285_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		setPursuingEnemyState(runtime, enemy)
	},

	async Es_game_Event286(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		
		tilePathfinding.updateInstance(enemy, runtime.dt)
		
		// collision resolving: enemy - wall
		resolveInstanceWallCollision(enemy, enemyWalkableTiles)
		
		// collision resolving: enemy - enemy2
		runtime.objects.enemyBase.getAllInstances().forEach((enemy2) => {
			if(enemy.uid != enemy2.uid){
				const collision = tilePathfinding.defineCollision(enemy, enemy2, 40)
			
				if(collision){
					enemy.x -= collision.strX
					enemy.y -= collision.strY
					enemy2.x += collision.strX
					enemy2.y += collision.strY
					
					if(!enemy.behaviors.Timer.isTimerRunning("changedPathAfterCollision") && enemy.instVars.state == "patroling" && enemy2.instVars.state == "patroling"){
		                enemy.behaviors.Timer.startTimer(1, "changedPathAfterCollision")				
		                defineEnemyPathFromPoint(runtime, enemy, 1)
		                defineEnemyPathFromPoint(runtime, enemy2, 1)
					}
		            if(!enemy.behaviors.Timer.isTimerRunning("movementBlocked") && !enemy2.behaviors.Timer.isTimerRunning("movementBlocked")){
		                enemy.behaviors.Timer.startTimer(0.5, "movementBlocked")
		            }
				}
			}
		})
		
		// collision resolving: enemy - player
		if (runtime.globalVars.gamePhase == 0) {
		    runtime.objects.enemyBase.getAllInstances().forEach((enemy) => {
		        let collision = null
		
		        // solider (shield)
		        if (enemy.instVars.id == 4) {
		            const pos = {
		                x: enemy.x + Math.cos(enemy.angle) * 8,
		                y: enemy.y + Math.sin(enemy.angle) * 8
		            }
		
		            // instead of defining the maxDist using the enemy's position, we move a bit (8) away the center of radius (40)
		            collision = tilePathfinding.defineCollision(pos, player, 40)
		        }
		
		        // others
		        else collision = tilePathfinding.defineCollision(enemy, player, 28)    
		
		        if (collision) {
		            /* since we determine the specific center of radius for a soldier for resolving collision,
					we have to know the actual body overlapping between the soldier and the player in order to kill*/
		            let dist = 0
		            if (enemy.instVars.id == 4) {
		                dist = utils.distance(enemy.x, enemy.y, player.x, player.y)
		            }
		            if (dist < 40 && enemy.instVars.id != -1) runtime.callFunction("killEnemy", enemy.uid)
					
		            enemy.x -= collision.strX
		            enemy.y -= collision.strY
		            player.x += collision.strX
		            player.y += collision.strY			
		        }
		    })
		}
		
		if(enemy.instVars.tP_isMoving && !enemy.instVars.isSeeingPlayer) {
			enemy.angle =
			C3.angleLerp(enemy.angle, enemy.instVars.tP_movingAngle, 0.125*runtime.globalVars.dt60)
		}
	},

	async Es_game_Event296_Act21(runtime, localVars)
	{
		const skinAspect = 1+runtime.objects.ArraySkins.getFirstPickedInstance().getAt(runtime.globalVars.player_skinIndex, 3)/100
		
		const enemy1 = runtime.objects.enemyBase.getFirstPickedInstance()
		runtime.objects.enemyBase.getAllInstances().forEach((enemy2) => {
			if(enemy1 != enemy2 && C3.distanceTo(enemy1.x, enemy1.y, enemy2.x, enemy2.y) < enemy2.instVars.susDistance*skinAspect){
				setSuspiciousEnemyState(runtime, enemy2, enemy1.x, enemy1.y, 100)
			}
		})
	},

	async Es_game_Event338(runtime, localVars)
	{
		roulette.normalizeVariants(localVars.t, localVars.p)
		localVars.i = roulette.isOneVariant()
	},

	async Es_game_Event355(runtime, localVars)
	{
		localVars.newVariant = roulette.newVariant()
		roulette.prevVariant = localVars.newVariant
	},

	async Es_game_Event358(runtime, localVars)
	{
		localVars.i = roulette.randomizer()
	},

	async Es_game_Event364_Act2(runtime, localVars)
	{
		runtime.objects.enemyBase.getAllInstances().forEach(tilePathfinding.stopMoveInstance)
	},

	async Es_game_Event385_Act3(runtime, localVars)
	{
		tilePathfinding.stopMoveInstance(player)
		destroyPathLines(runtime)
	},

	async Es_game_Event386_Act3(runtime, localVars)
	{
		tilePathfinding.stopMoveInstance(player)
		destroyPathLines(runtime)
	},

	async Es_game_Event399_Act1(runtime, localVars)
	{
		if(localVars.x != -1){
			const text = runtime.objects.text_noOut.getFirstPickedInstance()
			const price = skinPrices[localVars.x]
			text.text = String(price+"$")
			runtime.globalVars.shopPrice = price
		}
	},

	async Es_game_Event401_Act1(runtime, localVars)
	{
		const i = runtime.callFunction("defineSkinI", 0)
		localVars.price = i!=-1 ? +skinPrices[i] : i
	},

	async Es_game_Event457(runtime, localVars)
	{
		if(!player.instVars.tP_isMoving){
			const inst = runtime.objects.goTo.getFirstPickedInstance()
			const toX = inst.x
			const toY = inst.y
			tilePathfinding.defineInstancePath(player, toX, toY, playerWalkableTiles)
			createPathLines(runtime, player)
		}
	},

	async Es_game_Event459_Act1(runtime, localVars)
	{
		const enemy = runtime.objects.enemyBase.getFirstPickedInstance()
		tilePathfinding.defineInstancePath(enemy, enemy.x, enemy.y+3*32, enemyWalkableTiles, false, false, 1)
	}
};

self.C3.ScriptsInEvents = scriptsInEvents;
