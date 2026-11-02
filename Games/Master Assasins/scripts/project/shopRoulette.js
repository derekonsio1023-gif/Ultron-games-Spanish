// normalizeVariants() -> isOneVariant() -> newVariant()... -> randomizer()
export const roulette = {	
	normalizeVariants(t, p){
		this.variants = t.split(",")
		this.probablityTable = p.split(",")
	},
	isOneVariant(){
		let acc = 0
		let variant = null
		this.variants.forEach((elem, i) => {
			if(elem == 0) {
				variant = i
				acc++
			}
		})
		return acc == 1 ? variant : 0 
	},
	choose(arr){
		const finalArr = []
		arr.forEach(([skin, count]) => {
			for(let j=0; j<count; j++){
				finalArr.push(skin)
			}
		})
		return finalArr[Math.floor(Math.random()*finalArr.length)]
	},	
	newVariant(){
		const arr = []
		this.variants.forEach((purchased, i) => {
			if(purchased == 0 && this.prevVariant != i) arr.push(i)			
		})
		return arr[Math.floor(Math.random()*arr.length)] 
	},
	randomizer(){
		const arr = []
		const clearProbablityTable = []
		this.variants.forEach((isPurchased, skin) => {
			if(isPurchased==0) {
				arr.push(skin)
				clearProbablityTable.push(this.probablityTable[skin])
			}
		})
		return this.choose(arr.map((skin, i)  => [skin, clearProbablityTable[i]])) 
	}
} 