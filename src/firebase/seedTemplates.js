export const PUBLIC_TEMPLATES = [
  {
    title: "Spanish Greetings & Farewells",
    gameType: "multiple-choice",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "¿Cómo se dice 'Hello'?", options: ["Hola", "Adiós", "Gracias", "Por favor"], correct: 0, timeLimit: 15 },
      { question: "¿Cómo se dice 'Goodbye'?", options: ["Hola", "Adiós", "Buenos días", "Hasta luego"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'Good morning'?", options: ["Buenas noches", "Buenas tardes", "Buenos días", "Buenas"], correct: 2, timeLimit: 15 },
      { question: "¿Cómo se dice 'Good night'?", options: ["Buenos días", "Buenas tardes", "Hola", "Buenas noches"], correct: 3, timeLimit: 15 },
      { question: "¿Cómo se dice 'See you later'?", options: ["Adiós", "Hasta luego", "Por favor", "Gracias"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'How are you?'", options: ["¿Cómo te llamas?", "¿Dónde estás?", "¿Cómo estás?", "¿Qué quieres?"], correct: 2, timeLimit: 15 },
      { question: "¿Cómo se dice 'Nice to meet you'?", options: ["Mucho gusto", "De nada", "Lo siento", "Con permiso"], correct: 0, timeLimit: 15 },
      { question: "¿Cómo se dice 'You're welcome'?", options: ["Gracias", "Por favor", "De nada", "Perdón"], correct: 2, timeLimit: 15 },
    ]
  },
  {
    title: "Numbers 1–20",
    gameType: "true-or-false",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { statement: "'Uno' means the number 1.", isTrue: true, timeLimit: 5 },
      { statement: "'Tres' means the number 5.", isTrue: false, timeLimit: 5 },
      { statement: "'Diez' means the number 10.", isTrue: true, timeLimit: 5 },
      { statement: "'Ocho' means the number 6.", isTrue: false, timeLimit: 5 },
      { statement: "'Quince' means the number 15.", isTrue: true, timeLimit: 5 },
      { statement: "'Doce' means the number 20.", isTrue: false, timeLimit: 5 },
      { statement: "'Veinte' means the number 20.", isTrue: true, timeLimit: 5 },
      { statement: "'Siete' means the number 8.", isTrue: false, timeLimit: 5 },
    ]
  },
  {
    title: "Food & Drinks",
    gameType: "multiple-choice",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "¿Cómo se dice 'water'?", options: ["Leche", "Agua", "Jugo", "Café"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'bread'?", options: ["Arroz", "Pan", "Carne", "Queso"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'chicken'?", options: ["Cerdo", "Res", "Pollo", "Pescado"], correct: 2, timeLimit: 15 },
      { question: "¿Cómo se dice 'rice'?", options: ["Arroz", "Frijoles", "Maíz", "Papa"], correct: 0, timeLimit: 15 },
      { question: "¿Cómo se dice 'coffee'?", options: ["Té", "Jugo", "Agua", "Café"], correct: 3, timeLimit: 15 },
      { question: "¿Cómo se dice 'apple'?", options: ["Naranja", "Plátano", "Manzana", "Uva"], correct: 2, timeLimit: 15 },
    ]
  },
  {
    title: "Colors in Spanish",
    gameType: "type-answer",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "How do you say 'red'?", acceptedAnswers: ["rojo", "roja"], display: "rojo/roja", hint: "Think: 'rouge' in French", timeLimit: 15 },
      { question: "How do you say 'blue'?", acceptedAnswers: ["azul"], display: "azul", hint: "Starts with 'a'", timeLimit: 15 },
      { question: "How do you say 'green'?", acceptedAnswers: ["verde"], display: "verde", hint: "Think: verdant", timeLimit: 15 },
      { question: "How do you say 'yellow'?", acceptedAnswers: ["amarillo", "amarilla"], display: "amarillo", hint: "Starts with 'a'", timeLimit: 15 },
      { question: "How do you say 'white'?", acceptedAnswers: ["blanco", "blanca"], display: "blanco/blanca", hint: "Think: blank", timeLimit: 15 },
      { question: "How do you say 'black'?", acceptedAnswers: ["negro", "negra"], display: "negro/negra", hint: "Starts with 'n'", timeLimit: 15 },
    ]
  },
  {
    title: "Spanish-Speaking Countries",
    gameType: "opinion-poll",
    category: "culture",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "Which country would you most like to visit?", options: ["Mexico", "Spain", "Colombia", "Argentina"], timeLimit: 20, discussionPrompt: "What do you know about that country?" },
      { question: "Which Spanish food sounds most delicious?", options: ["Tacos", "Paella", "Arepas", "Asado"], timeLimit: 20, discussionPrompt: "Have you tried any of these?" },
      { question: "Which Spanish accent sounds coolest to you?", options: ["Mexican", "Castilian", "Colombian", "Argentine"], timeLimit: 20, discussionPrompt: "Can you spot differences between accents?" },
    ]
  },
  {
    title: "Present Tense — HABLAR",
    gameType: "type-answer",
    category: "conjugation",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "Conjugate 'hablar' for YO (I speak)", acceptedAnswers: ["hablo"], display: "hablo", hint: "Ends in -o", timeLimit: 15 },
      { question: "Conjugate 'hablar' for TU (you speak)", acceptedAnswers: ["hablas"], display: "hablas", hint: "Ends in -as", timeLimit: 15 },
      { question: "Conjugate 'hablar' for EL/ELLA (he/she speaks)", acceptedAnswers: ["habla"], display: "habla", hint: "Ends in -a", timeLimit: 15 },
      { question: "Conjugate 'hablar' for NOSOTROS (we speak)", acceptedAnswers: ["hablamos"], display: "hablamos", hint: "Ends in -amos", timeLimit: 15 },
      { question: "Conjugate 'hablar' for VOSOTROS (you all speak)", acceptedAnswers: ["habláis", "hablais"], display: "habláis", hint: "Ends in -áis", timeLimit: 15 },
      { question: "Conjugate 'hablar' for ELLOS (they speak)", acceptedAnswers: ["hablan"], display: "hablan", hint: "Ends in -an", timeLimit: 15 },
    ]
  },
  {
    title: "Present Tense — COMER & VIVIR",
    gameType: "type-answer",
    category: "conjugation",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "Conjugate 'comer' for YO (I eat)", acceptedAnswers: ["como"], display: "como", hint: "Ends in -o", timeLimit: 15 },
      { question: "Conjugate 'comer' for TU (you eat)", acceptedAnswers: ["comes"], display: "comes", hint: "Ends in -es", timeLimit: 15 },
      { question: "Conjugate 'vivir' for YO (I live)", acceptedAnswers: ["vivo"], display: "vivo", hint: "Ends in -o", timeLimit: 15 },
      { question: "Conjugate 'vivir' for NOSOTROS (we live)", acceptedAnswers: ["vivimos"], display: "vivimos", hint: "Ends in -imos", timeLimit: 15 },
      { question: "Conjugate 'comer' for ELLOS (they eat)", acceptedAnswers: ["comen"], display: "comen", hint: "Ends in -en", timeLimit: 15 },
      { question: "Conjugate 'vivir' for ELLOS (they live)", acceptedAnswers: ["viven"], display: "viven", hint: "Ends in -en", timeLimit: 15 },
    ]
  },
  {
    title: "Build a Sentence — Basic Phrases",
    gameType: "puzzle",
    category: "grammar",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "Build: 'I want to eat tacos'", items: ["tacos", "Yo", "comer", "quiero"], correctOrder: [1, 3, 2, 0], hint: "Subject → verb → infinitive → object", timeLimit: 30 },
      { question: "Build: 'Good morning, how are you?'", items: ["¿cómo", "Buenos", "estás?", "días,"], correctOrder: [1, 3, 0, 2], hint: "Start with the time greeting", timeLimit: 30 },
      { question: "Build: 'She is very happy'", items: ["muy", "Ella", "feliz", "está"], correctOrder: [1, 3, 0, 2], hint: "Subject → verb → adverb → adjective", timeLimit: 30 },
      { question: "Build: 'We speak Spanish at work'", items: ["en", "Nosotros", "español", "hablamos", "el trabajo"], correctOrder: [1, 3, 2, 0, 4], hint: "Subject → verb → language → location", timeLimit: 35 },
    ]
  },
  {
    title: "True or False — Spanish Culture",
    gameType: "true-or-false",
    category: "culture",
    visibility: "public",
    ownerId: null,
    questions: [
      { statement: "Spanish is the second most spoken language in the world by native speakers.", isTrue: true, timeLimit: 8 },
      { statement: "Brazil is a Spanish-speaking country.", isTrue: false, timeLimit: 8 },
      { statement: "There are 21 countries where Spanish is an official language.", isTrue: true, timeLimit: 8 },
      { statement: "The Spanish spoken in Spain and Latin America is completely different.", isTrue: false, timeLimit: 8 },
      { statement: "'Siesta' is a traditional afternoon rest common in Spain.", isTrue: true, timeLimit: 8 },
      { statement: "The Real Academia Española regulates the Spanish language.", isTrue: true, timeLimit: 8 },
    ]
  },
  {
    title: "Travel & Directions",
    gameType: "multiple-choice",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { question: "¿Cómo se dice 'airport'?", options: ["Estación", "Aeropuerto", "Hotel", "Puerto"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'left'?", options: ["Derecha", "Recto", "Izquierda", "Atrás"], correct: 2, timeLimit: 15 },
      { question: "¿Cómo se dice 'right'?", options: ["Izquierda", "Recto", "Atrás", "Derecha"], correct: 3, timeLimit: 15 },
      { question: "¿Cómo se dice 'How much does it cost?'", options: ["¿Dónde está?", "¿Cuánto cuesta?", "¿Qué hora es?", "¿Cómo se llama?"], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'I need help'?", options: ["Necesito ayuda", "Tengo hambre", "Estoy perdido", "Quiero agua"], correct: 0, timeLimit: 15 },
    ]
  },
  {
    title: "Workplace Spanish",
    gameType: "word-cloud",
    category: "vocabulary",
    visibility: "public",
    ownerId: null,
    questions: [
      { prompt: "Write one Spanish word you'd use at work", timeLimit: 30, hasCorrectAnswer: false },
      { prompt: "How do you say 'meeting' in Spanish? (one word)", timeLimit: 20, hasCorrectAnswer: true, acceptedAnswers: ["reunión", "reunion", "junta"] },
      { prompt: "Name a Spanish-speaking colleague or client country", timeLimit: 25, hasCorrectAnswer: false },
      { prompt: "How do you say 'deadline' in Spanish? (one word)", timeLimit: 20, hasCorrectAnswer: true, acceptedAnswers: ["plazo", "fecha límite", "vencimiento"] },
    ]
  },
  {
    title: "Space Station Español — Full Mission",
    gameType: "robot-run",
    category: "mixed",
    visibility: "public",
    ownerId: null,
    questions: [
      { type: "multiple-choice", tier: 1, question: "¿Cómo se dice 'hello'?", options: ["Hola", "Adiós", "Gracias", "Por favor"], correct: 0, points: 300 },
      { type: "true-false", tier: 1, question: "'Agua' means water.", isTrue: true, points: 300 },
      { type: "multiple-choice", tier: 1, question: "¿Cómo se dice 'thank you'?", options: ["Hola", "Sí", "Gracias", "No"], correct: 2, points: 300 },
      { type: "true-false", tier: 1, question: "'Gato' means dog.", isTrue: false, points: 300 },
      { type: "multiple-choice", tier: 1, question: "¿Cómo se dice 'house'?", options: ["Carro", "Casa", "Calle", "Campo"], correct: 1, points: 300 },
      { type: "multiple-choice", tier: 2, question: "Which is correct: 'Yo ___ español'?", options: ["hablas", "hablo", "habla", "hablan"], correct: 1, points: 500 },
      { type: "true-false", tier: 2, question: "Adjectives always come before nouns in Spanish.", isTrue: false, points: 500 },
      { type: "multiple-choice", tier: 2, question: "¿Cuál es la capital de México?", options: ["Guadalajara", "Cancún", "Ciudad de México", "Monterrey"], correct: 2, points: 500 },
      { type: "true-false", tier: 2, question: "'Ser' and 'Estar' both mean 'to be'.", isTrue: true, points: 500 },
      { type: "multiple-choice", tier: 2, question: "Complete: 'Nosotros ___ en casa'", options: ["estoy", "está", "estamos", "están"], correct: 2, points: 500 },
      { type: "multiple-choice", tier: 3, question: "Which uses subjunctive correctly?", options: ["Quiero que tú vengas", "Quiero que tú vienes", "Quiero que tú venir", "Quiero que tú vino"], correct: 0, points: 800 },
      { type: "true-false", tier: 3, question: "'Éxito' means 'exit' in Spanish.", isTrue: false, points: 800 },
      { type: "multiple-choice", tier: 3, question: "Preterite of 'ir' for 'él'?", options: ["iba", "fue", "va", "irá"], correct: 1, points: 800 },
      { type: "true-false", tier: 3, question: "'Por' and 'Para' are interchangeable.", isTrue: false, points: 800 },
      { type: "multiple-choice", tier: 3, question: "Which is a false cognate?", options: ["animal", "hospital", "embarazada", "hotel"], correct: 2, points: 800 },
    ]
  },
];
