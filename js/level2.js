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
const connectionCountTxt = document.getElementById('connection-count');
const systemMessage = document.getElementById('system-message');
const metricsPanel = document.getElementById('metrics-panel');
const modalSuccess = document.getElementById('success-modal');
const modalFail = document.getElementById('fail-modal');

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
let mouseX = 0;
let mouseY = 0;
let isTraining = false;

function initNodes() {
    const startX = canvas.width * 0.15;
    const midX = canvas.width * 0.5;
    const endX = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'in1', x: startX, y: centerY - 100, radius: 25, color: '#06b6d4', label: 'Audio', type: 'input' },
        { id: 'in2', x: startX, y: centerY + 100, radius: 25, color: '#06b6d4', label: 'Text', type: 'input' },
        { id: 'hid1', x: midX, y: centerY - 100, radius: 30, color: '#ff3366', label: 'Hidden Node 1', type: 'hidden' },
        { id: 'hid2', x: midX, y: centerY + 100, radius: 30, color: '#ff3366', label: 'Hidden Node 2', type: 'hidden' },
        { id: 'out1', x: endX, y: centerY, radius: 40, color: '#8b5cf6', label: 'Prediction', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.02;
        this.progress = 0;
    }
    update() {
        this.progress += this.speed;
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#27c93f'; ctx.fill();
        ctx.shadowBlur = 8; ctx.shadowColor = '#27c93f';
    }
}

function drawNode(node) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 20);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    connections.forEach(conn => {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = isTraining ? '#27c93f' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 5;
        ctx.stroke();
    });

    if (draggingFromNode) {
        ctx.beginPath();
        ctx.moveTo(draggingFromNode.x, draggingFromNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = draggingFromNode.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (isTraining) {
        if (Math.random() > 0.5 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y));
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

function getHoveredNode(x, y) {
    return nodes.find(node => Math.hypot(node.x - x, node.y - y) <= node.radius + 15);
}

canvas.addEventListener('mousedown', (e) => {
    if (isTraining) return;
    const rect = canvas.getBoundingClientRect();
    const clickedNode = getHoveredNode(e.clientX - rect.left, e.clientY - rect.top);
    if (clickedNode && (clickedNode.type === 'input' || clickedNode.type === 'hidden')) {
        draggingFromNode = clickedNode;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mouseup', () => {
    if (draggingFromNode) {
        const targetNode = getHoveredNode(mouseX, mouseY);
        
        if (targetNode && targetNode.id !== draggingFromNode.id) {
            const isForward = (draggingFromNode.type === 'input' && (targetNode.type === 'hidden' || targetNode.type === 'output')) || 
                              (draggingFromNode.type === 'hidden' && targetNode.type === 'output');
            
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);

            if (isForward && !exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                connectionCountTxt.innerText = connections.length;
                trainBtn.disabled = false;
                systemMessage.innerText = "Network updated. Ready to train.";
            }
        }
        draggingFromNode = null;
    }
});

trainBtn.addEventListener('click', () => {
    isTraining = true;
    trainBtn.disabled = true;
    metricsPanel.style.display = "block";
    
    let hasDirectConnection = connections.some(c => c.from.type === 'input' && c.to.type === 'output');
    
    let maxEpochs = 50;
    let currentEpoch = 0;
    let acc = 10;
    let loss = 1.50;
    
    let targetAcc = hasDirectConnection ? 52 : 96;
    let targetLoss = hasDirectConnection ? 0.65 : 0.08;

    const trainingInterval = setInterval(() => {
        currentEpoch++;
        
        acc += (targetAcc - acc) * 0.1; 
        loss += (targetLoss - loss) * 0.1;

        document.getElementById('epoch-count').innerText = currentEpoch;
        document.getElementById('accuracy-score').innerText = `${Math.floor(acc)}%`;
        document.getElementById('loss-score').innerText = loss.toFixed(2);

        if (hasDirectConnection && currentEpoch > 25) {
            document.getElementById('accuracy-score').style.color = '#ffbd2e';
        }

        if (currentEpoch >= maxEpochs) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (hasDirectConnection) {
                    modalFail.classList.remove('hidden');
                } else {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(2, 3);
                }
            }, 600);
        }
    }, 80);
});

resizeCanvas();
draw();