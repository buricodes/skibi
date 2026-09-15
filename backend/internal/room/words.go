package room

import "math/rand/v2"

// Draw-phase word list. Deliberately simple, drawable-in-60-seconds nouns —
// swap/extend freely, this isn't load-bearing logic.
var wordList = []string{
	"banana", "robot", "castle", "dinosaur", "pizza", "rocket", "wizard",
	"octopus", "guitar", "volcano", "penguin", "dragon", "sandwich",
	"unicorn", "tornado", "pirate", "spaceship", "mermaid", "cactus", "ninja",
	"astronaut", "jellyfish", "lighthouse", "campfire", "skateboard",
}

func pickWord() string {
	return wordList[rand.IntN(len(wordList))]
}
