export const utils = {
	manhattanDistance: (x1, y1, x2, y2) => Math.abs(x2-x1) + Math.abs(y2-y1),
	clamp: (val, min, max) => Math.min(Math.max(val, min), max),
	distance: (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
	d2r: (deg) => deg * Math.PI / 180,	
	round: (x, to) => Math.floor(x/to)*to 
}