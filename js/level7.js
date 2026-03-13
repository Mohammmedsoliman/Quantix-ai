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

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const trainBtn = document.getElementById('train-btn');
const systemMessage = document.getElementById('system-message');
const metricsPanel = document.getElementById('metrics-panel');
const modalSuccess = document.getElementById('success-modal');
const modalFail = document.getElementById('fail-modal');
const failReasonTxt = document.getElementById('fail-reason');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    initNodes();
}
window.addEventListener('resize', resizeCanvas);

let nodes = [];
let connections = [];
let dataParticles = [];
let draggingFromNode = null;
let mouseX = 0; let mouseY = 0;
let isTraining = false;

function initNodes() {
    const col1 = canvas.width * 0.15;
    const col2 = canvas.width * 0.40;
    const col3 = canvas.width * 0.65;
    const col4 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'text_in', x: col1, y: centerY, radius: 35, color: '#06b6d4', label: '📝 Raw Reviews', type: 'input' },
        { id: 'tok', x: col2, y: centerY - 80, radius: 35, color: '#f43f5e', label: '✂️ Tokenizer', type: 'processor' },
        { id: 'emb', x: col3, y: centerY + 80, radius: 35, color: '#f59e0b', label: '🔢 Word Embeddings', type: 'processor' },
        { id: 'out1', x: col4, y: centerY, radius: 45, color: '#8b5cf6', label: 'Sentiment AI', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, color) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.015 + Math.random() * 0.015;
        this.progress = 0;
        this.color = color; 
    }
    update() {
        this.progress += this.speed;
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
    }
}

function drawNode(node) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 20);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    connections.forEach(conn => {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = isTraining ? conn.from.color : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 5; ctx.stroke();
    });

    if (draggingFromNode) {
        ctx.beginPath();
        ctx.moveTo(draggingFromNode.x, draggingFromNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = draggingFromNode.color;
        ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (isTraining) {
        if (Math.random() > 0.4 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, conn.from.color));
        }

        for (let i = dataParticles.length - 1; i >= 0; i--) {
            let p = dataParticles[i];
            p.update(); p.draw();
            if (p.progress >= 1) dataParticles.splice(i, 1);
        }
    }

    nodes.forEach(drawNode);
    requestAnimationFrame(draw);
}

function getHoveredNode(x, y) { return nodes.find(n => Math.hypot(n.x - x, n.y - y) <= n.radius + 15); }

canvas.addEventListener('mousedown', (e) => {
    if (isTraining) return;
    const rect = canvas.getBoundingClientRect();
    const clickedNode = getHoveredNode(e.clientX - rect.left, e.clientY - rect.top);
    if (clickedNode && clickedNode.type !== 'output') draggingFromNode = clickedNode;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mouseup', () => {
    if (draggingFromNode) {
        const targetNode = getHoveredNode(mouseX, mouseY);
        if (targetNode && targetNode.id !== draggingFromNode.id && targetNode.type !== 'input') {
            
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);
            
            let isForward = true;
            if (draggingFromNode.type === 'processor' && targetNode.type === 'input') isForward = false;
            
            if (isForward && !exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                
                document.getElementById('connection-count').innerText = "Routing...";
                
                let outHasIn = connections.some(c => c.to.type === 'output');
                let inHasOut = connections.some(c => c.from.type === 'input');
                
                if (outHasIn && inHasOut) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Pipeline connected. Run analysis.";
                    document.getElementById('connection-count').innerText = "Ready";
                    document.getElementById('connection-count').style.color = "#27c93f";
                }
            }
        }
        draggingFromNode = null;
    }
});

trainBtn.addEventListener('click', () => {
    isTraining = true;
    trainBtn.disabled = true;
    metricsPanel.style.display = "block";
    systemMessage.innerText = "Reading text...";
    
    let skippedTok = connections.some(c => c.from.id === 'text_in' && c.to.id !== 'tok');
    let skippedEmb = connections.some(c => c.to.id === 'out1' && c.from.id !== 'emb');
    let directToAI = connections.some(c => c.from.id === 'text_in' && c.to.id === 'out1');
    
    let isSuccess = !skippedTok && !skippedEmb && !directToAI;
    
    let frame = 0;
    let accuracy = 10;

    let targetAcc = isSuccess ? 95 : 0;

    const trainingInterval = setInterval(() => {
        frame++;
        accuracy += (targetAcc - accuracy) * 0.15; 
        
        document.getElementById('epoch-count').innerText = `Review ${frame}`;
        document.getElementById('accuracy-score').innerText = `${Math.floor(accuracy)}%`;
        
        let statusText = document.getElementById('loss-score');
        
        if (!isSuccess && frame === 10) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            document.getElementById('accuracy-score').style.color = '#ff5f56';
            statusText.innerText = "CRASHED";
            statusText.style.color = '#ff5f56';
            
            if (directToAI) {
                failReasonTxt.innerHTML = "TypeError: Expected Float array, got String. <br><br>The AI cannot do math on the word 'Awesome'.";
            } else if (skippedEmb) {
                failReasonTxt.innerHTML = "ValueError: Token IDs are not embedded. <br><br>You chopped up the words, but you forgot to translate them into vector math!";
            } else if (skippedTok) {
                failReasonTxt.innerHTML = "SyntaxError: Cannot embed full paragraph. <br><br>You must chop the sentence into individual Word Tokens first!";
            }
            
            setTimeout(() => { modalFail.classList.remove('hidden'); }, 500);
            return;
        }

        if (isSuccess && frame > 15) {
            document.getElementById('accuracy-score').style.color = '#27c93f';
            statusText.innerText = "Comprehending...";
            statusText.style.color = '#27c93f';
        }

        if (frame >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            // 🔴 تم نقل الـ updateProgress هنا عشان يشتغل مرة واحدة بس بأمان
            setTimeout(async () => { 
                modalSuccess.classList.remove('hidden'); 
                await updateProgress(7, 8);
            }, 800);
        }
    }, 60);
});

resizeCanvas();
draw();