package ai

type Core struct {
	Role    string
	Content string
}

// var Messages [] *Core

type Message struct {
	Model    string  `json:"model"`
	Messages []*Core `json:"messages"`
}

// {

//   "model": "llama-3.3-70b-versatile",
//   "messages": [{
//       "role": "user",
//       "content": "Explain how to build an athletic physique"
//   }]
// }
