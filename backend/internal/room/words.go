package room

import "math/rand/v2"

// Draw-round word list. Deliberately simple, drawable-in-under-a-minute
// nouns — swap/extend freely, this isn't load-bearing logic.
var wordList = []string{
	"banana", "robot", "castle", "dinosaur", "pizza", "rocket", "wizard",
	"octopus", "guitar", "volcano", "penguin", "dragon", "sandwich",
	"unicorn", "tornado", "pirate", "spaceship", "mermaid", "cactus", "ninja",
	"astronaut", "jellyfish", "lighthouse", "campfire", "skateboard",
	"mummy", "skeleton", "vampire", "werewolf", "witch", "cauldron",
	"potion", "genie", "phoenix", "griffin", "minotaur", "sphinx",
	"pyramid", "scorpion", "camel", "oasis", "mirage", "boomerang",
	"platypus", "chameleon", "peacock", "toucan", "parrot", "sloth",
	"porcupine", "hippo", "rhino", "walrus", "narwhal", "seahorse",
	"starfish", "squid", "stingray", "pretzel", "waffle", "croissant",
	"lollipop", "marshmallow", "canoe", "kayak", "surfboard", "snorkel",
	"parachute", "trampoline", "scarecrow", "haystack", "silo", "sled",
	"icicle", "avalanche", "glacier", "geyser", "cave", "fossil",
	"meteor", "comet", "satellite", "cyborg", "hologram", "boat",
}

// pickWordChoices returns n distinct random words for the drawer to choose
// from (a shuffle-then-take, so no duplicates within one set of choices).
func pickWordChoices(n int) []string {
	idx := make([]int, len(wordList))
	for i := range idx {
		idx[i] = i
	}
	rand.Shuffle(len(idx), func(i, j int) { idx[i], idx[j] = idx[j], idx[i] })

	if n > len(idx) {
		n = len(idx)
	}
	choices := make([]string, n)
	for i := 0; i < n; i++ {
		choices[i] = wordList[idx[i]]
	}
	return choices
}
