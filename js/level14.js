import { auth, db } from "./auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
});

async function updateProgress(levelId, nextLevelId) {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid, "levels", levelId.toString()), {
            levelId: levelId,
            status: "completed",
            accuracy: 100,
            lastActive: serverTimestamp(),
            lastError: "None"
        }, { merge: true });

        const nextRef = doc(db, "users", currentUser.uid, "levels", nextLevelId.toString());
        const nextSnap = await getDoc(nextRef);

        if (!nextSnap.exists() || nextSnap.data().status !== "completed") {
            await setDoc(nextRef, {
                levelId: nextLevelId,
                status: "active",
                lastActive: serverTimestamp()
            }, { merge: true });
            console.log(`Level ${levelId} completed. Level ${nextLevelId} is now active!`);
        } else {
            console.log(`Level ${nextLevelId} is already completed. Skipping downgrade.`);
        }
    } catch (error) {
        console.error("Error updating progress:", error);
    }
}

const editor = document.getElementById('python-editor');
const runBtn = document.getElementById('run-code-btn');
const terminal = document.getElementById('terminal-output');
const compilerStatus = document.getElementById('compiler-status');

function printToTerminal(text, type = 'system') {
    const p = document.createElement('p');
    p.innerText = text;
    if (type === 'error') p.className = 'terminal-error';
    if (type === 'success') p.className = 'terminal-success';
    if (type === 'system') p.className = 'terminal-system';
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

runBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
    printToTerminal('> Executing nlp_model.py...', 'system');
    compilerStatus.innerText = "Processing text...";
    compilerStatus.style.color = "#ffbd2e";
    runBtn.disabled = true;

    const code = editor.value.replace(/\s+/g, '');

    setTimeout(() => {
        evaluateNLP(code);
    }, 800);
});

function evaluateNLP(code) {
    let hasError = false;

    const tokRegex = /tokenizer=Tokenizer\(num_words=5000\)/;
    if (!hasError && !tokRegex.test(code)) {
        printToTerminal("TypeError: Expected float32 array, got String 'This movie is amazing'.", "error");
        printToTerminal("Hint: The AI can't read words! You need to initialize the Tokenizer(num_words=5000) so we can map words to numbers.", "system");
        hasError = true;
    }

    const padRegex = /padded_reviews=pad_sequences\(sequences,maxlen=50\)/;
    if (!hasError && !padRegex.test(code)) {
        printToTerminal("ValueError: Data arrays must all be the same length to create a Tensor.", "error");
        printToTerminal("Hint: One review is 4 words, another is 6. You must use `pad_sequences(sequences, maxlen=50)` to make them all size 50 by adding zeros.", "system");
        hasError = true;
    }

    const embedRegex = /model\.add\(Embedding\(5000,16,input_length=50\)\)/;
    if (!hasError && !embedRegex.test(code)) {
        printToTerminal("ValueError: Input 0 of layer dense is incompatible.", "error");
        printToTerminal("Hint: You passed pure token IDs to the network! You must add an Embedding(5000, 16, input_length=50) layer to give the words meaning.", "system");
        hasError = true;
    }

    if (hasError) {
        compilerStatus.innerText = "Build Failed";
        compilerStatus.style.color = "#ff5f56";
        runBtn.disabled = false;
    } else {
        compilerStatus.innerText = "Pipeline Valid";
        compilerStatus.style.color = "#27c93f";
        printToTerminal("Text successfully vectorized and padded.", "success");
        printToTerminal("Training Sentiment Analysis Model...", "system");
        simulateNLPTraining();
    }
}

function simulateNLPTraining() {
    let currentEpoch = 1;
    let acc = 50.0; 
    let loss = 0.69;

    const trainingInterval = setInterval(async () => {
        acc += Math.floor(Math.random() * 5) + 3;
        loss -= (Math.random() * 0.08 + 0.02);

        if (acc > 95) acc = 95.8;
        if (loss < 0.1) loss = 0.12;

        printToTerminal(`Epoch ${currentEpoch}/10 - loss: ${loss.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)}`, 'system');
        currentEpoch++;

        if (currentEpoch > 10) {
            clearInterval(trainingInterval);
            printToTerminal("Training Complete. AI can now detect sentiment.", "success");
            
            compilerStatus.innerText = "Level Cleared!";
            compilerStatus.style.color = "#27c93f";
            
            await updateProgress(14, 15); 
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-primary';
            nextBtn.style.marginTop = '15px';
            nextBtn.innerText = 'Next Level: Recurrent Networks';
            nextBtn.onclick = () => alert("Proceeding to Level 15...");
            terminal.appendChild(nextBtn);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }, 400);
}