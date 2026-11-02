import { utils } from "./utils.js"

class TilePathfinding {
    constructor(widthInCells, heightInCells, cellSize, C3) {
        this.width = widthInCells
        this.height = heightInCells
        this.cellSize = cellSize
        this.map = Array.from({ length: this.height }).map(() => Array.from({ length: this.width }).map(() => 0))
        this.C3 = C3
    }

    #defineG(fromX, fromY, toX, toY, diagonalCostScale, tileCosts) {
        const tileCost = tileCosts ? tileCosts[this.tileAt(toX, toY)] ?? 10 : 10
        return (toX - fromX != 0 && toY - fromY == 0) || (toY - fromY != 0 && toX - fromX == 0) ? tileCost : diagonalCostScale * tileCost
    }

    #getDirection(x1, y1, x2, y2) {
        const a = x2 - x1
        const b = y2 - y1
        let state = ''
        if (a < 0) state += 'left'
        else if (a != 0) state += 'right'
        if (b < 0) state += 'top'
        else if (b != 0) state += 'bottom'
        return state
    }

    #findPath(fromCellX, fromCellY, toCellX, toCellY, walkableTiles, layeredTiles, tileCosts, diagonalCostScale = 1.4) {
        const closed = new Map()
        const open = new Map()
        if (!this.isWalkableTile(utils.clamp(toCellX, 0, this.width - 1), utils.clamp(toCellY, 0, this.height - 1), walkableTiles, layeredTiles)) {
            return false
        }

        open.set(`${fromCellX},${fromCellY}`, {
            x: fromCellX,
            y: fromCellY,
            F: 0,
            G: 0,
            parent: null
        })
        while (open.size) {
            let minF = Infinity
            let currentKey = null

            open.forEach((val, key) => {
                if (val.F < minF) {
                    minF = val.F
                    currentKey = key
                }
            })

            closed.set(currentKey, open.get(currentKey))
            open.delete(currentKey)

            let currentVal = closed.get(currentKey)

            if (currentVal.x == toCellX && currentVal.y == toCellY) {
                const path = [[currentVal.x * this.cellSize + this.cellSize / 2, currentVal.y * this.cellSize + this.cellSize / 2]]
                let a = currentVal
                while (true) {
                    let b, c = null
                    if (a.parent) b = closed.get(a.parent)
                    if (b && b.parent) c = closed.get(b.parent)
                    else return path
                    if (b && this.#getDirection(path[path.length - 1][0], path[path.length - 1][1], b.x * this.cellSize + this.cellSize / 2, b.y * this.cellSize + this.cellSize / 2) != this.#getDirection(b.x * this.cellSize + this.cellSize / 2, b.y * this.cellSize + this.cellSize / 2, c.x * this.cellSize + this.cellSize / 2, c.y * this.cellSize + this.cellSize / 2)) {
                        path.push([b.x * this.cellSize + this.cellSize / 2, b.y * this.cellSize + this.cellSize / 2])
                    }
                    a = b
                }
            }

            for (let i = -1; i < 2; i++) {
                for (let j = -1; j < 2; j++) {
                    if (i == 0 && j == 0) continue

                    const checkingPosition = {
                        x: currentVal.x + j,
                        y: currentVal.y + i,
                    }

                    const key = `${checkingPosition.x},${checkingPosition.y}`

                    if (!closed.has(key) &&
						checkingPosition.x >= 0 &&
						checkingPosition.x < this.width &&
						checkingPosition.y >= 0 &&
						checkingPosition.y < this.height &&
						this.isWalkableTile(checkingPosition.x, checkingPosition.y, walkableTiles, layeredTiles)) {

                        // without angle shortcuts
                        let isAnglePossible = true
                        if (Math.abs(i) && Math.abs(j)) {
						isAnglePossible = 	this.isWalkableTile(currentVal.x + j, currentVal.y, walkableTiles, layeredTiles) &&
											this.isWalkableTile(currentVal.x, currentVal.y + i, walkableTiles, layeredTiles)
						}

                        if (isAnglePossible) {
                            const G = this.#defineG(checkingPosition.x, checkingPosition.y, currentVal.x, currentVal.y, diagonalCostScale, tileCosts) + currentVal.G

                            if (!open.has(key)) {
                                const H = utils.manhattanDistance(checkingPosition.x, checkingPosition.y, toCellX, toCellY) * 10
                                const F = G + H
                                open.set(key,
                                    {
                                        x: checkingPosition.x,
                                        y: checkingPosition.y,
                                        F: F,
                                        G: G,
                                        parent: currentKey
                                    }
                                )
                            }
                            else {
                                const checkingVal = open.get(key)
                                if (G < checkingVal.G) {
                                    checkingVal.G = G
                                    checkingVal.F = G + utils.manhattanDistance(checkingVal.x, checkingVal.y, toCellX, toCellY) * 10
                                    checkingVal.parent = currentKey
                                }
                            }
                        }
                    }
                }
            }
        }

        return false
    }

    #updateInstanceWaypoint(instance) {
        const vars = instance.instVars
        vars.tP_i++
        const nodeI = instance.pathfindingNodes.length - vars.tP_i - 1
        vars.tP_toX = instance.pathfindingNodes[nodeI][0]
        vars.tP_toY = instance.pathfindingNodes[nodeI][1]
    }

    updateInstance(instance, dt) {
        const vars = instance.instVars

        if (vars.tP_isMoving && !(instance.objectType.name != "playerBase" ? instance.behaviors.Timer.isTimerRunning("movementBlocked") : 0)) {
            let directionlength = 0
            vars.tP_velocity = Math.min(vars.tP_velocity + vars.tP_acceleration * dt, vars.tP_maxSpeed)
            vars.tP_movingAngle = this.C3.angleTo(instance.x, instance.y, vars.tP_toX, vars.tP_toY)
            vars.tP_directionX = vars.tP_toX - instance.x
            vars.tP_directionY = vars.tP_toY - instance.y
            directionlength = Math.sqrt(vars.tP_directionX ** 2 + vars.tP_directionY ** 2)
            vars.tP_directionX /= directionlength
            vars.tP_directionY /= directionlength

            if (this.inCell(instance.x) == this.inCell(vars.tP_goalX) && this.inCell(instance.y) == this.inCell(vars.tP_goalY)) {
                vars.tP_arrived = 1
                vars.tP_isMoving = 0
				vars.tP_goalX=-1
				vars.tP_goalY=-1
                instance.pathfindingNodes = false
            }

            else if (this.inCell(vars.tP_toX) == this.inCell(instance.x) && this.inCell(vars.tP_toY) == this.inCell(instance.y)) {
                this.#updateInstanceWaypoint(instance) // set new toX, toY
			}
        }

        else {
            vars.tP_velocity = Math.max(vars.tP_velocity - vars.tP_deceleration * dt, 0)
        }

        instance.x += vars.tP_directionX * vars.tP_velocity * dt
        instance.y += vars.tP_directionY * vars.tP_velocity * dt 
    }

    tileAt(x, y) {
        return this.map[y][x]
    }

    isWalkableTile(tileX, tileY, walkableTiles, layeredTiles) {
        for (let i = 0; i < walkableTiles.length; i++) {
            if (this.tileAt(tileX, tileY) == walkableTiles[i] && (!layeredTiles || !layeredTiles.has(`${tileX},${tileY}`))) {
                return true
            }
        }
        return false
    }

    inCell(x) {
        return Math.floor(x / this.cellSize)
    }

    defineInstancePath(instance, goalX, goalY, walkableTiles, layeredTiles, tileCosts, diagonalCostScale) {
        const path = this.#findPath(this.inCell(instance.x), this.inCell(instance.y), this.inCell(goalX), this.inCell(goalY), walkableTiles, layeredTiles, tileCosts, diagonalCostScale)
		if (path) {
            this.stopMoveInstance(instance)
            instance.pathfindingNodes = path
            instance.instVars.tP_isMoving = 1
            instance.instVars.tP_goalX = goalX
            instance.instVars.tP_goalY = goalY
            this.#updateInstanceWaypoint(instance)
        }
		return Boolean(path)
    }

    stopMoveInstance(instance) {
        instance.instVars.tP_i = -1
        instance.instVars.tP_isMoving = 0
        instance.instVars.tP_arrived = 0
    }
	
	defineCollision(pos1, pos2, maxDist) {
    	let directionX = pos2.x - pos1.x
    	let directionY = pos2.y - pos1.y
    	const directionLength2 = directionX ** 2 + directionY ** 2

    	if (maxDist ** 2 - directionLength2 > 0) {
        	const directionLength = Math.sqrt(directionLength2)
        	directionX /= directionLength
        	directionY /= directionLength
        	const overlap = maxDist - directionLength

        	const str = overlap / 2
        	const strX = directionX * str
        	const strY = directionY * str
        	return { strX, strY }
    	}

    	return false
	}
}

export { TilePathfinding }