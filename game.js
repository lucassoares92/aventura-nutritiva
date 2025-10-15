// Variáveis globais do jogo
const childEl = document.getElementById("child");
const gameAreaEl = document.getElementById("game-area");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const gameOverModal = document.getElementById("game-over-modal");
const finalScoreEl = document.getElementById("final-score");
const setupModal = document.getElementById("setup-modal");
const startGameBtn = document.getElementById("start-game-btn");

// Configurações e Estado
let currentLane = 1; // 0: Esquerda, 1: Centro, 2: Direita
let score = 0;
let lives = 3;
let isGameOver = false;
let baseSpeed = 4; // Velocidade base em pixels por frame
let speedMultiplier = 1;
let spawnRate = 2000; // Tempo em ms entre spawns (inicial)
let lastSpawnTime = 0;
let gameLoopId;
// Chance inicial de 30% para alimento ruim
let badFoodChance = 0.3;

// Emojis de Personagem
const CHARACTER_EMOJIS = {
  heroine: "🦸‍♀️",
  hero: "🦸‍♂️",
};
let selectedCharacter = null;

// Dados de Alimentos (emojis)
const GOOD_FOOD = [
  "🍎",
  "🥕",
  "🥦",
  "🍇",
  "🥛",
  "🍊",
  "🥝",
  "🥑",
  "🥚",
  "🌾",
  "🍄",
  "🌽",
  "🐟",
  "🍗",
  "💧",
];
const BAD_FOOD = ["🍔", "🍟", "🍩", "🍬", "🍕", "🥤", "🍦", "🍫"];

// Mapeamento das posições X das pistas (em porcentagem)
const LANE_POSITIONS = [15, 45, 75];

// --- Variáveis e Funções de Áudio (Tone.js) ---
let goodSound;
let badSound;
let selectSound; // Som para seleção de personagem
let startSound; // Som para início de jogo
let bgmLoop; // Loop para a BGM (agora contém a melodia principal e de Game Over)

// Configura os sons que serão usados no jogo
function setupAudio() {
  try {
    // Som de seleção (click leve)
    selectSound = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination();
    selectSound.volume.value = -15;

    // Som de início de jogo (mais forte)
    startSound = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.1, release: 0.5 },
    }).toDestination();
    startSound.volume.value = -10;

    // Som de sucesso (Good Food)
    goodSound = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 },
    }).toDestination();
    goodSound.volume.value = -10;

    // Som de falha/dano (Bad Food / Lose Life)
    badSound = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.5 },
    }).toDestination();
    badSound.volume.value = -10;

    // --- BGM PRINCIPAL: Melodia alegre (Lead Synth) ---
    const leadSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.8 },
      filter: { frequency: 1000, type: "lowpass" },
    }).toDestination();
    leadSynth.volume.value = -18;

    // Define o BPM para 145 para um ritmo menos frenético, mas ainda alegre.
    Tone.Transport.bpm.value = 145;

    // Sequência da MELODIA PRINCIPAL (simples, clássica e alegre em C Maior)
    const melodyNotes = [
      "C5",
      "G4",
      "E4",
      "G4",
      "A4",
      "G4",
      "F4",
      "E4",
      "D4",
      "F4",
      "E4",
      "D4",
      "G4",
      null,
      null,
      null, // Finaliza a frase
    ];

    const melodySequence = new Tone.Sequence(
      (time, note) => {
        if (note) {
          leadSynth.triggerAttackRelease(note, "8n", time);
        }
      },
      melodyNotes,
      "4n"
    );

    // --- BGM GAME OVER: Melodia de Decepção (Frustrante) ---
    const gameOverSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" }, // Usar Sawtooth para um som mais áspero/estridente
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 0.5 }, // Envelope mais rápido
    }).toDestination();
    gameOverSynth.volume.value = -10;

    // Sequência rápida e dissonante, descendente (Game Over Frustrante)
    // A4 (triste), Ab4 (tensão), G3 (queda), C#3 (dissonância final)
    const gameOverNotes = ["A4", "Ab4", "G3", "C#3"];

    const gameOverSequence = new Tone.Sequence(
      (time, note) => {
        if (note) {
          gameOverSynth.triggerAttackRelease(note, "16n", time);
        }
      },
      gameOverNotes,
      "8n"
    ); // Ritmo mais rápido
    gameOverSequence.loop = false; // Toca apenas uma vez

    // Armazena as referências para controle futuro (start/stop)
    bgmLoop = { melody: melodySequence, gameOver: gameOverSequence };
  } catch (error) {
    console.error(
      "Erro ao configurar o áudio (Tone.js). Áudio desativado:",
      error
    );
  }
}

// Inicia o contexto de áudio em resposta a uma ação do usuário (clique)
function startAudioContext() {
  if (Tone.context.state !== "running") {
    Tone.start().catch((e) =>
      console.error("Falha ao iniciar o contexto de áudio:", e)
    );
  }
}

// --- 0. Funções de Setup e Inicialização ---

// Função chamada pelos botões de seleção no modal
window.selectCharacter = function (type) {
  selectedCharacter = type;
  childEl.textContent = CHARACTER_EMOJIS[type];
  childEl.classList.remove("opacity-0");
  startGameBtn.disabled = false;
  startGameBtn.classList.replace("bg-gray-400", "bg-green-500");
  startGameBtn.classList.add("hover:bg-green-700", "active:scale-90");

  if (selectSound) {
    startAudioContext();
    selectSound.triggerAttackRelease("C6", "8n");
  }

  // Inicia a música de fundo (somente melodia) na tela de seleção, após o primeiro clique
  if (bgmLoop && Tone.Transport.state !== "started") {
    Tone.Transport.start();
    bgmLoop.melody.start(0);
  }

  // Feedback visual no modal (opcional: realçar o botão escolhido)
  document.querySelectorAll("#setup-modal button").forEach((btn) => {
    btn.style.boxShadow = "none";
    if (btn.onclick.toString().includes(`'${type}'`)) {
      btn.style.boxShadow = "0 0 0 4px rgba(76, 175, 80, 0.7)"; // Sombra verde
    }
  });
};

// Função que inicia o jogo após a seleção
window.startGame = function () {
  if (!selectedCharacter) {
    console.error("Nenhum personagem selecionado.");
    return;
  }

  // Som de início de jogo
  if (startSound) {
    startAudioContext();
    startSound.triggerAttackRelease("E4", "0.5");
  }

  setupModal.classList.add("hidden");
  updateChildPosition();
  updateLivesDisplay();
  updateDifficulty(); // Chama para inicializar a dificuldade
  gameLoop(0); // Inicia o loop do jogo
};

// Função para atualizar a posição visual da criança
function updateChildPosition() {
  childEl.style.left = `${LANE_POSITIONS[currentLane]}%`;
  childEl.style.transform = `translateX(-50%)`; // Centraliza o emoji na posição
}

// --- 1. Controle de Movimento da Criança ---

function moveChild(direction) {
  if (isGameOver) return;

  if (direction === "left" && currentLane > 0) {
    currentLane--;
  } else if (direction === "right" && currentLane < 2) {
    currentLane++;
  }
  updateChildPosition();
}

// Event Listeners do Teclado
document.addEventListener("keydown", (e) => {
  if (isGameOver || setupModal.classList.contains("hidden") === false) return;

  if (e.key === "ArrowLeft") {
    moveChild("left");
  } else if (e.key === "ArrowRight") {
    moveChild("right");
  }
});

// Event Listeners dos Botões (Mobile/Toque)
document
  .getElementById("move-left")
  .addEventListener("click", () => moveChild("left"));
document
  .getElementById("move-right")
  .addEventListener("click", () => moveChild("right"));

// --- 2. Geração e Movimento dos Alimentos ---

function updateDifficulty() {
  // Aumenta a velocidade e a taxa de spawn a cada 50 pontos
  speedMultiplier = 1 + Math.floor(score / 50) * 0.15;

  // Reduz o tempo de spawn (mínimo de 600ms)
  spawnRate = Math.max(600, 2000 - Math.floor(score / 50) * 200);

  // Aumenta a chance de alimento ruim (máximo de 50% ou 0.5)
  // Aumenta 5% a cada 100 pontos: Math.floor(score / 100) * 0.05
  const badFoodIncrease = Math.floor(score / 100) * 0.05;
  badFoodChance = Math.min(0.5, 0.3 + badFoodIncrease);
}

function createFoodItem() {
  if (isGameOver) return;

  // Usa a chance dinâmica para decidir se é bom ou ruim
  const isBad = Math.random() < badFoodChance;
  const isGood = !isBad;

  const foodArray = isGood ? GOOD_FOOD : BAD_FOOD;
  const emoji = foodArray[Math.floor(Math.random() * foodArray.length)];
  const lane = Math.floor(Math.random() * 3); // Pista aleatória (0, 1, 2)

  const item = document.createElement("div");
  item.className = `food-item absolute lane-${lane}`;
  item.textContent = emoji;
  item.dataset.type = isGood ? "good" : "bad";
  item.dataset.lane = lane;
  item.dataset.collected = "false"; // Novo flag para controle de remoção

  // Força a posição inicial superior
  item.style.top = "-100px";

  // Centraliza o item na pista
  item.style.left = `${LANE_POSITIONS[lane]}%`;
  item.style.transform = `translateX(-50%)`;
  gameAreaEl.appendChild(item);
}

function moveFoodItems() {
  const foodItems = document.querySelectorAll(".food-item");
  const gameHeight = gameAreaEl.offsetHeight;
  const moveStep = baseSpeed * speedMultiplier;

  foodItems.forEach((item) => {
    // Ignora itens já coletados que estão em processo de fade-out
    if (item.dataset.collected === "true") {
      return;
    }

    let currentTop = parseFloat(item.style.top);
    currentTop += moveStep;
    item.style.top = `${currentTop}px`;

    // --- 3. Checagem de Colisão e Limpeza ---

    // 3.1. Alimento saiu da tela
    // Removido quando o topo do item passar da parte de baixo da tela
    if (currentTop > gameHeight) {
      item.remove();

      // Se um alimento bom sai da tela, perde vida (punição por não pegar)
      if (item.dataset.type === "good") {
        loseLife(false);
      }
    } else if (
      // 3.2. Colisão (Detecta quando o item está visivelmente sobre a criança)
      // Altura superior: quando o topo do item alcança a altura do peito da criança (GameHeight - 120px)
      currentTop >= gameHeight - 120 &&
      // Altura inferior: quando o item está prestes a sair pelos pés da criança (GameHeight - 40px)
      currentTop < gameHeight - 40
    ) {
      const itemLane = parseInt(item.dataset.lane);

      if (itemLane === currentLane) {
        handleCollision(item);
        // A remoção com delay ocorre dentro de handleCollision.
      }
    }
  });
}

// --- 4. Funções de Status do Jogo ---

function updateScore(points) {
  score += points;
  scoreEl.textContent = `Pontos: ${score}`;
  updateDifficulty(); // Chama para recalcular a dificuldade após cada ponto
}

function updateLivesDisplay() {
  livesEl.textContent = "Vidas: " + "🍎".repeat(lives) + "💀".repeat(3 - lives);
}

function loseLife(wasCollision) {
  lives--;
  updateLivesDisplay();

  // --- ÁUDIO: Toca som de decepção/erro ---
  if (badSound) {
    // Toca uma nota grave e curta (G3)
    badSound.triggerAttackRelease("G3", "0.4");
  }

  // Efeito visual de dano na criança: muda para vermelho por um instante
  if (wasCollision) {
    childEl.style.color = "red";
    setTimeout(() => {
      childEl.style.color = "inherit";
    }, 100);
  }

  if (lives <= 0) {
    endGame();
  }
}

function handleCollision(item) {
  // Marca o item como coletado para que moveFoodItems o ignore nas próximas iterações
  item.dataset.collected = "true";

  if (item.dataset.type === "good") {
    updateScore(10);
    // --- ÁUDIO: Toca som de sucesso (Alegre Chime) ---
    if (goodSound) {
      // Toca duas notas ascendentes (C5 e G5) para um feedback feliz
      goodSound.triggerAttackRelease("C5", "16n");
      goodSound.triggerAttackRelease("G5", "8n", Tone.now() + 0.1);
    }

    // Efeito visual de coleta
    item.style.opacity = "0";

    // Efeito de Pontuação Flutuante
    const scorePopup = document.createElement("div");
    scorePopup.className = "floating-score";
    scorePopup.textContent = "+10";

    // Posicionar o popup perto da criança
    scorePopup.style.left = `${LANE_POSITIONS[currentLane]}%`;
    scorePopup.style.bottom = "100px";
    scorePopup.style.transform = `translateX(-50%)`;

    gameAreaEl.appendChild(scorePopup);

    // Remove o popup após a animação de 800ms
    setTimeout(() => {
      scorePopup.remove();
    }, 800);
  } else if (item.dataset.type === "bad") {
    // Perde vida ao pegar alimento ruim (o loseLife aciona o badSound)
    loseLife(true);
    // Efeito visual de colisão
    item.style.color = "red";
    item.style.opacity = "0";
  }

  // Remove o item APÓS a transição CSS (300ms) para que o efeito opacity:0 funcione
  setTimeout(() => {
    item.remove();
  }, 300);
}

function endGame() {
  isGameOver = true;
  cancelAnimationFrame(gameLoopId);

  // Para a música de fundo alegre
  if (bgmLoop) {
    bgmLoop.melody.stop();

    // Inicia a música de decepção
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
    // Adicionamos um pequeno delay para garantir que o som anterior pare
    bgmLoop.gameOver.start(Tone.now() + 0.1);
  }

  finalScoreEl.textContent = `Sua pontuação final foi de ${score} pontos.`;
  gameOverModal.classList.remove("hidden");
}

// --- 5. Loop Principal ---

function gameLoop(timestamp) {
  if (isGameOver) return;

  // Gerenciamento de Spawn
  if (timestamp - lastSpawnTime > spawnRate) {
    createFoodItem();
    lastSpawnTime = timestamp;
  }

  moveFoodItems();
  gameLoopId = requestAnimationFrame(gameLoop);
}

// Inicialização
window.onload = () => {
  setupAudio(); // Configura os sons
  // O jogo agora espera que o usuário escolha um personagem no modal
};
