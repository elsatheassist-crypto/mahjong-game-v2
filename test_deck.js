
const { createFullDeck } = require('./src/core/wall');
const { Suit } = require('./src/core/tile');

const deck = createFullDeck();
const flowerTiles = deck.filter(t => t.suit === Suit.FLOWER);
console.log('Flower tiles count:', flowerTiles.length);
console.log('Total deck count:', deck.length);
