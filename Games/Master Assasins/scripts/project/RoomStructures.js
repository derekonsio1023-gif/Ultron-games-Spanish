import { utils } from "./utils.js"

export function RoomStructures(mapGenerator, room) {
    const noiseRandom = mapGenerator.noiseRandom.bind(mapGenerator)
    const choose = mapGenerator.choose.bind(mapGenerator)
    const tilemapSolid = mapGenerator.tilemapSolid
    const tilemapFloor = mapGenerator.tilemapFloor
    const [x, y, width, height] = room.sides
    const info = room.info
    const avoidTiles = room.avoidTiles
	const runtime = mapGenerator.runtime
	const tilePathfindingMap = mapGenerator.tilePathfindingMap
	const mapStyle = mapGenerator.mapStyle

	this.setProp = {
		box(x, y){
			tilemapSolid.setTileAt(x, y, mapStyle*6 + 3)
			tilemapFloor.setTileAt(x, y, -1)			
			tilePathfindingMap[y][x] = 1
		},
		bush(x, y){
			runtime.objects.bush.createInstance("level_walls", x*32 + 16, y*32 + 16)
			tilemapSolid.setTileAt(x, y, 18)
			tilemapFloor.setTileAt(x, y, -1)
			tilePathfindingMap[y][x] = 2
		},
		wall(x, y){
			tilemapSolid.setTileAt(x, y, 0)
			tilemapFloor.setTileAt(x, y, -1)
			tilePathfindingMap[y][x] = 1
		},
		air(x, y){
			tilemapFloor.setTileAt(x, y, -1)
			tilePathfindingMap[y][x] = 1
		},
		turret(x, y){
			for(let i=-1; i<2; i++){
				for(let j=-1; j<2; j++){
					tilePathfindingMap[y+i][x+j] = 1
				}
			}
			const atX = x*32 + 16
			const atY = y*32 + 16
			const turretShadow = runtime.objects.turretShadow.createInstance("level_shadows", atX, atY)
			turretShadow.colorRgb = [runtime.globalVars.bgR/255, runtime.globalVars.bgG/255, runtime.globalVars.bgB/255]
			runtime.objects.turretStand.createInstance("level_floor+", atX, atY)
			const turretBase = runtime.objects.turretBase.createInstance("level_walls", atX, atY)
			turretBase.zElevation = -2			
		}
	}

    this.types = [
        // 1
        {
            check: () => {
                return width >= 4 && height >= 4
            },
            build: () => {
                const toPlace = []
                const final = []
                const chance = 0.4
                const freq = 8
                for (let i = 1; i < height; i++) {
                    if (noiseRandom(freq) < chance) {
                        toPlace.push([x + 1, y + i])
                    }
                    if (noiseRandom(freq) < chance) {
                        toPlace.push([x + width - 1, y + i])
                    }
                }

                for (let j = 2; j < width-1; j++) {
                    if (noiseRandom(freq) < chance) {
                        toPlace.push([x + j, y + 1])
                    }
                    if (noiseRandom(freq) < chance) {
                        toPlace.push([x + j, y + height - 1])
                    }
                }

                toPlace.forEach(([x1, y1]) => {
                    let isOk = true
                    avoidTiles.forEach(([x2, y2]) => {
                        if (utils.manhattanDistance(x1, y1, x2, y2) <= 2) isOk = false
                    })
                    if (isOk) final.push([x1, y1])
                })

                final.forEach(([x, y]) => {
					choose([this.setProp.box, 9], [this.setProp.bush, 1])(x, y)                	
				})
            },
        },

        // 2
        {
            check: () => {
                return !info.has("extended") && noiseRandom > 0.25 && width >= 4 && height >= 4 && width % 4 == 0 && height % 4 == 0
            },
            build: () => {
                const distanceX = utils.clamp(Math.floor(width / 4), 2, 4)
                const distanceY = utils.clamp(Math.floor(height / 4), 2, 4)
                const countX = width / distanceX
                const countY = height / distanceY

                for (let i = 0; i < countY - 1; i++) {
                    for (let j = 0; j < countX - 1; j++) {
                        const atX = distanceX + x + distanceX * j
                        const atY = distanceY + y + distanceY * i
                        avoidTiles.push([atX, atY])
						this.setProp.wall(atX, atY)
                    }
                }
            },
            boxesPossible: true
        },

        // 3
        {
            check: () => {
                return width >= 6 && height >= 6 && width <= 14 && height <= 14 && width % 2 == 0 && height % 2 == 0
            },
            build: () => {
                const centerX = Math.floor(x + width / 2)
                const centerY = Math.floor(y + height / 2)
                for (let i = -1; i < 2; i++) {
                    for (let j = -1; j < 2; j++) {
						if(i==0 && j==0) continue
                        const atX = centerX + j
                        const atY = centerY + i
                        avoidTiles.push([atX, atY])
                       this.setProp.bush(atX, atY)
                    }
                }
                this.setProp.wall(centerX, centerY)
            },
            boxesPossible: true
        },

        // 4
        {
            check: () => {
                return width >= 5 && height >= 5 && width <= 16 && height <= 16
            },
            build: () => {
                const countX = Math.floor((width - 2) / 3)
                const countY = Math.floor((height - 2) / 3)
                const ox = width == 16 ? 1 : 0
                const oy = height == 16 ? 1 : 0
                const chance = 0.8
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = ox + 2 + x + 3 * j
                        const atY = oy + 2 + y + 3 * i
                        if (noiseRandom() < chance) this.setProp.box(atX, atY)
                        if (noiseRandom() < chance) this.setProp.box(atX+1, atY)
                        if (noiseRandom() < chance) this.setProp.box(atX, atY+1)
                        if (noiseRandom() < chance) this.setProp.box(atX+1, atY+1)
                    }
                }
            }					
        },

        // 5
        {
            check: () => {
                return width >= 6 && height >= 6 && width <= 16 && height <= 16
            },
            build: () => {
                const countX = Math.round(width / 3 - 1)
                const countY = Math.floor(height / 2 - 1) - (height % 2 == 0 ? 1 : 0)
                const oi = height % 2 == 0 ? noiseRandom(0) < 0.5 ? 1 : 0 : 0
                const chance = 0.9
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = 2 + x + 3 * j
                        const atY = 2 + y + 2 * i + Number(j % 2 == 0) + oi
                        if (noiseRandom() < chance) this.setProp.box(atX, atY)
                        if (noiseRandom() < chance) this.setProp.box(atX+1, atY)
                    }
                }
            }
        },

        // 6
        {
            check: () => {
                return width >= 4 && height >= 6 && width <= 16 && height <= 16
            },
            build: () => {
                const countX = Math.floor(width / 2 - 1)
                const countY = Math.round(height / 3 - 1)
                const chance = 0.9
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = 2 + x + 2 * j
                        const atY = Math.min(2 + y + 3 * i + Number(j % 2 == 0), y + height - 3)
                        if (noiseRandom() < chance) this.setProp.box(atX, atY)
                        if (noiseRandom() < chance) this.setProp.box(atX, atY+1)
                    }
                }
            }
        },

        // 7
        {
            check: () => {
                return width >= 8 && height >= 8 && width % 2 == 0 && height % 2 == 0
            },
            build: () => {
                const countX = Math.floor((width-1)/7)
                const countY = Math.floor((height-1)/7)
                const chance = 0.2
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = 4 + x + Math.floor(j / countX * width)
                        const atY = 4 + y + Math.floor(i / countY * height)
                        for (let a = -1; a <= 1; a++) {
                            if (noiseRandom() < chance) {
                                choose([this.setProp.box, 2], [this.setProp.bush, 1])(atX + a, atY - 2)
                                avoidTiles.push([atX + a, atY - 2])
                            }
                            if (noiseRandom() < chance) {
                                choose([this.setProp.box, 2], [this.setProp.bush, 1])(atX + a, atY + 2)									
                                avoidTiles.push([atX + a, atY + 2])
                            } 
                            if (noiseRandom() < chance) {
                                choose([this.setProp.box, 2], [this.setProp.bush, 1])(atX + 2, atY + a)
                                avoidTiles.push([atX + 2, atY + a])
                            }
                            if (noiseRandom() < chance) {
                                choose([this.setProp.box, 2], [this.setProp.bush, 1])(atX - 2, atY + a)									
                                avoidTiles.push([atX - 2, atY + a])
                            }                             

                            for (let b = -1; b <= 1; b++) {
                                if (a == 0 && b == 0) this.setProp.air(atX, atY)
                                else {
                                    this.setProp.wall(atX + b, atY + a) 
                                    avoidTiles.push([atX + b, atY + a])
                                }
                            }
                        }
                    }
                }
            },
            boxesPossible: true
        },

        // 8
        {
            check: () => {
                return width >= 5 && height >= 5 && width <= 10 && height <= 10
            },
            build: () => {
                const ox = width == 16 ? 1 : 0
                const oy = height == 16 ? 1 : 0
                const countX = Math.floor((width - 2) / 3)
                const countY = Math.floor((height - 2) / 3)
                const chance = 0.8
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = ox + 2 + x + 3 * j
                        const atY = oy + 2 + y + 3 * i
                        if (noiseRandom() < 0.5) {
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX, atY)
							this.setProp.wall(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1) 
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                        else {
							this.setProp.wall(atX, atY)
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1)
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                    }
                }
            }
        },

        // 9
        {
            check: () => {
                return width >= 5 && height >= 5 && width > height && width <= 10
            },
            build: () => {
                const countX = Math.floor((width - 2) / 3)
                const countY = Math.floor((height - 2) / 3)
                const ox = width == 16 ? 1 : 0
                const oy = height == 16 ? 1 : 0
                const chance = 0.8
                for (let i = 0; i < countY; i++) {
                    if (i != 0 && i != countY - 1) continue
                    for (let j = 0; j < countX; j++) {
                        const atX = ox + 2 + x + 3 * j
                        const atY = oy + 2 + y + 3 * i
                        if (noiseRandom() < 0.5) {					
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX, atY)
							this.setProp.wall(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1) 
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                        else {
							this.setProp.wall(atX, atY)
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1)
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                    }
                }
            }
        },

        // 10
        {
            check: () => {
                return width >= 5 && height >= 5 && height > width && height <= 10
            },
            build: () => {
                const countX = Math.floor((width - 2) / 3)
                const countY = Math.floor((height - 2) / 3)
                const ox = width == 16 ? 1 : 0
                const oy = height == 16 ? 1 : 0
                const chance = 0.8
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        if (j != 0 && j != countX - 1) continue
                        const atX = ox + 2 + x + 3 * j
                        const atY = oy + 2 + y + 3 * i
                        if (noiseRandom() < 0.5) {					
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX, atY)
							this.setProp.wall(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1) 
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                        else {
							this.setProp.wall(atX, atY)
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX + 1, atY)
                            if (noiseRandom() < chance) this.setProp.wall(atX, atY + 1)
                            if (noiseRandom() < chance) this.setProp.wall(atX + 1, atY + 1)
                        }
                    }
                }
            }
        },

        // 11
        {
            check: () => {
                return width >= 10 && height >= 10
            },
            build: () => {
                const takeSize = 5
                const chance = 0.4
                const freq = 10
                for (let i = 0; i < height - takeSize; i++) {
                    for (let j = 0; j < width - takeSize; j++) {
                        const atX = Math.ceil(takeSize / 2) + x + j
                        const atY = Math.ceil(takeSize / 2) + y + i
                        if (i == 0 || i == height - takeSize - 1 || j == 0 || j == width - takeSize - 1) {
							this.setProp.wall(atX, atY)
                            avoidTiles.push([atX, atY])

                            if (j == 0 && noiseRandom(freq) < chance) {
								choose([this.setProp.box, 9], [this.setProp.bush, 1])(atX - 1, atY)                                
                                avoidTiles.push([atX - 1, atY])
                            }
                            if (j == width - takeSize - 1 && noiseRandom(freq) < chance) {
                                choose([this.setProp.box, 9], [this.setProp.bush, 1])(atX + 1, atY)   
                                avoidTiles.push([atX + 1, atY])
                            }
                            if (i == 0 && noiseRandom(freq) < chance) {
                                choose([this.setProp.box, 9], [this.setProp.bush, 1])(atX, atY - 1)   
                                avoidTiles.push([atX, atY - 1])
                            }
                            if (i == height - takeSize - 1 && noiseRandom(freq) < chance) {
                                choose([this.setProp.box, 9], [this.setProp.bush, 1])(atX, atY + 1)   
                                avoidTiles.push([atX, atY + 1])
                            }
                        }
                        else this.setProp.air(atX, atY)
                    }
                }
            },
            boxesPossible: true
        },

        // 12
        {
            check: () => {
                return width >= 8 && height >= 8
            },
            build: () => {
                const countX = Math.floor((width-2)/4)
                const countY = Math.floor((height-2)/4)
                const chance = 0.5
                for (let i = 0; i < countY; i++) {
                    for (let j = 0; j < countX; j++) {
                        const atX = 3 + x + j*4
                        const atY = 3 + y + i*4
						this.setProp.wall(atX, atY)
                        avoidTiles.push([atX, atY])
                        this.setProp.wall(atX, atY - 1)
                        avoidTiles.push([atX, atY - 1])
                        this.setProp.wall(atX, atY + 1)
                        avoidTiles.push([atX, atY + 1])
                        this.setProp.wall(atX - 1, atY)
                        avoidTiles.push([atX - 1, atY])
                        this.setProp.wall(atX + 1, atY)
                        avoidTiles.push([atX + 1, atY])


                        if (noiseRandom() < chance) {
							choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX - 1, atY - 1)                            
                            avoidTiles.push([atX - 1, atY - 1])
                        }
                        if (noiseRandom() < chance) {
                            choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX + 1, atY - 1)
                            avoidTiles.push([atX + 1, atY - 1])
                        }
                        if (noiseRandom() < chance) {
                            choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX - 1, atY + 1)
                            avoidTiles.push([atX - 1, atY + 1])
                        }
                        if (noiseRandom() < chance) {
                           	choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX + 1, atY + 1)
                            avoidTiles.push([atX + 1, atY + 1])
                        }
                    }
                }
            },
            boxesPossible: true
        },

        // 13
        {
            check: () => {
                return width >= 10 && height >= 12 
            },
            build: () => {
                const takeSize = 3
                const realHeight = Math.floor((height - takeSize) / 3)
                const chance = 0.6
                const freq = 8
                for (let i = 0; i < realHeight; i++) {
                    for (let j = 0; j < width - takeSize; j++) {
                        const atX = Math.ceil(takeSize / 2) + x + j
                        let atY = Math.ceil(takeSize / 2) + y + i
                        if (i == 0 || i == realHeight - 1 || j == 0 || j == width - takeSize - 1) {
							this.setProp.wall(atX, atY)
                            avoidTiles.push([atX, atY])
                            if (i == realHeight - 1 && noiseRandom(freq) < chance) {
								choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX , atY + 1)
                                avoidTiles.push([atX, atY + 1])
                            }
                        }
                        else this.setProp.air(atX, atY)

                        atY = y + height - (Math.ceil(takeSize / 2) + i)
                        if (i == 0 || i == realHeight - 1 || j == 0 || j == width - takeSize - 1) {
                            this.setProp.wall(atX, atY)
                            avoidTiles.push([atX, atY])
                            if (i == realHeight - 1 && noiseRandom(freq) < chance) {
                                choose([this.setProp.box, 3], [this.setProp.bush, 1])(atX , atY - 1)
                                avoidTiles.push([atX, atY - 1])
                            }
                        }
                        else this.setProp.air(atX, atY)
                    }
                }
            },
            boxesPossible: true
        },

        // 14
        {
            check: () => {
                return width >= 7 && height >= 7 && width <= 12 && height <= 12
            },
            build: () => {
                const chance = 0.35
                const freq = 3
                for (let i = 2; i < height - 1; i++) {
                    const atX = x + Math.floor(width / 2)
                    const atY = y + i
					this.setProp.wall(atX, atY)

				 	const cy = Math.floor(height / 2)
                    if (i != cy) {					
                        if (i == cy+1 || i==cy-1 || noiseRandom(freq) < chance) {
                            choose([this.setProp.box, 4], [this.setProp.bush, 1])(atX - 1 , atY)
                            avoidTiles.push([atX - 1, atY])
                        }
                        if (i == cy+1 || i==cy-1 || noiseRandom(freq) < chance) {
                            choose([this.setProp.box, 4], [this.setProp.bush, 1])(atX + 1 , atY)
                            avoidTiles.push([atX + 1, atY])
                        }
                    }

                    avoidTiles.push([atX, atY])
                }
                for (let j = 2; j < width - 1; j++) {
                    const atX = x + j
                    const atY = y + Math.floor(height / 2)
                    this.setProp.wall(atX, atY)

                    if (j != Math.floor(width / 2)) {
                        if (noiseRandom(freq) < chance) {
                            choose([this.setProp.box, 4], [this.setProp.bush, 1])(atX , atY - 1)
                            avoidTiles.push([atX, atY - 1])
                        }
                        if (noiseRandom(freq) < chance) {
                            choose([this.setProp.box, 4], [this.setProp.bush, 1])(atX, atY + 1)
                            avoidTiles.push([atX, atY + 1])
                        }
                    }

                    avoidTiles.push([atX, atY])
                }
            },
            boxesPossible: true
        },

        //15
        {
            check: () => {
                return width >= 8 && height >= 8 && width < 15 && height < 15
            },
            build: () => {
                const w = Math.floor(width / 2)
                const h = Math.floor(height / 2)

				this.setProp.turret(x + w, y + h)

                const horizontal = () => {
                    const atX1 = Math.floor(x + w / 2)
                    const atX2 = Math.floor(x + width - w / 2)

					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX1, y + h - 1)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX1, y + h)					
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX1, y + h + 1)					
                    avoidTiles.push([atX1, y + h - 1])
                    avoidTiles.push([atX1, y + h])
                    avoidTiles.push([atX1, y + h + 1])
                    
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX2, y + h - 1)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX2, y + h)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(atX2, y + h + 1)	
                    avoidTiles.push([atX2, y + h - 1])
                    avoidTiles.push([atX2, y + h])
                    avoidTiles.push([atX2, y + h + 1])
                }
                
                const vertical = () => {
                    const atY1 = Math.floor(y + h / 2)
                    const atY2 = Math.floor(y + height - h / 2)

					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w - 1, atY1)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w, atY1)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w + 1, atY1)
                    avoidTiles.push([x + w - 1, atY1])
                    avoidTiles.push([x + w, atY1])
                    avoidTiles.push([x + w + 1, atY1])

					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w - 1, atY2)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w, atY2)
					choose([this.setProp.wall, 2], [this.setProp.box, 2], [this.setProp.bush, 1])(x + w + 1, atY2)
                    avoidTiles.push([x + w - 1, atY2])
                    avoidTiles.push([x + w, atY2])
                    avoidTiles.push([x + w + 1, atY2])
                }

//                 if (width == 8 || height == 8) {
//                     if (noiseRandom() > 0.5) horizontal()                    
//                     else vertical()
//                 }
//                 else {
//                     horizontal()
//                     vertical()
//                 }

                    if (noiseRandom() > 0.5) horizontal()                    
                    else vertical()
            },
            boxesPossible: true,
			isTurret: true
        }
    ]
}