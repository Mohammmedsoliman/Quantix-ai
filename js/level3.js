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
    const col1 = canvas.width * 0.15;
    const col2 = canvas.width * 0.40;
    const col3 = canvas.width * 0.65;
    const col4 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'in1', x: col1, y: centerY, radius: 30, color: '#ffbd2e', label: 'Raw Data (Noisy)', type: 'input' },
        { id: 'filter', x: col2, y: centerY, radius: 35, color: '#3b82f6', label: 'Data Filter', type: 'filter' },
        { id: 'hid1', x: col3, y: centerY - 80, radius: 30, color: '#ff3366', label: 'Hidden 1', type: 'hidden' },
        { id: 'hid2', x: col3, y: centerY + 80, radius: 30, color: '#ff3366', label: 'Hidden 2', type: 'hidden' },
        { id: 'out1', x: col4, y: centerY, radius: 45, color: '#8b5cf6', label: 'AI Prediction', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, isCorrupted) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.015 + Math.random() * 0.02;
        this.progress = 0;
        this.isCorrupted = isCorrupted; 
    }
    update() {
        this.progress += this.speed;
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.isCorrupted ? '#ff5f56' : '#27c93f'; 
        ctx.fill();
        ctx.shadowBlur = 10; 
        ctx.shadowColor = this.isCorrupted ? '#ff5f56' : '#27c93f';
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
        ctx.strokeStyle = isTraining ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
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
        if (Math.random() > 0.4 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            
            let isCorrupt = false;
            if (conn.from.id === 'in1' && conn.to.id !== 'filter') {
                isCorrupt = Math.random() > 0.3; 
            } else if (conn.from.id === 'in1' && conn.to.id === 'filter') {
                isCorrupt = Math.random() > 0.5; 
            } else if (conn.from.id === 'filter') {
                isCorrupt = false; 
            } else if (conn.from.type === 'hidden') {
                let sourceConn = connections.find(c => c.to.id === conn.from.id);
                if (sourceConn && sourceConn.from.id === 'in1') isCorrupt = Math.random() > 0.3;
            }

            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, isCorrupt));
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
    if (clickedNode && clickedNode.type !== 'output') {
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
        
        if (targetNode && targetNode.id !== draggingFromNode.id && targetNode.type !== 'input') {
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);

            let isForward = true;
            if (draggingFromNode.type === 'hidden' && targetNode.type === 'filter') isForward = false;
            if (draggingFromNode.type === 'output') isForward = false;

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
    
    let bypassedFilter = connections.some(c => c.from.type === 'input' && c.to.type !== 'filter');
    
    let maxEpochs = 50;
    let currentEpoch = 0;
    let acc = 10;
    let loss = 2.00;
    
    let targetAcc = bypassedFilter ? 34 : 98;
    let targetLoss = bypassedFilter ? 1.85 : 0.05;

    const trainingInterval = setInterval(() => {
        currentEpoch++;
        
        acc += (targetAcc - acc) * 0.15; 
        loss += (targetLoss - loss) * 0.15;

        document.getElementById('epoch-count').innerText = currentEpoch;
        document.getElementById('accuracy-score').innerText = `${Math.floor(acc)}%`;
        document.getElementById('loss-score').innerText = loss.toFixed(2);

        if (bypassedFilter && currentEpoch > 15) {
            document.getElementById('accuracy-score').style.color = '#ff5f56';
            document.getElementById('loss-score').style.color = '#ff5f56';
        }

        if (currentEpoch >= maxEpochs) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (bypassedFilter) {
                    modalFail.classList.remove('hidden');
                } else {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(3, 4);
                }
            }, 600);
        }
    }, 80);
});

resizeCanvas();
draw();