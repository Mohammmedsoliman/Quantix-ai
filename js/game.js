import { auth, db } from "./auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// 🔴 تم إضافة getDoc هنا
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
});

// 🔴 دالة الحفظ الجديدة (Safe Unlock & Accuracy)
async function updateProgress(levelId, nextLevelId) {
    if (!currentUser) return;

    try {
        // 1. تحديث المستوى الحالي لـ completed مع 100% دقة
        await setDoc(doc(db, "users", currentUser.uid, "levels", levelId.toString()), {
            levelId: levelId,
            status: "completed",
            accuracy: 100,
            lastActive: serverTimestamp(),
            lastError: "None"
        }, { merge: true });

        // 2. الفتح الآمن للمستوى اللي بعده
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
const epochTxt = document.getElementById('epoch-count');
const accuracyTxt = document.getElementById('accuracy-score');
const lossTxt = document.getElementById('loss-score');
const modal = document.getElementById('success-modal');

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
    const startX = canvas.width * 0.25;
    const endX = canvas.width * 0.75;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'in1', x: startX, y: centerY - 120, radius: 30, color: '#06b6d4', label: 'Images (Pixels)', type: 'input' },
        { id: 'in2', x: startX, y: centerY + 120, radius: 30, color: '#06b6d4', label: 'Labels (Tags)', type: 'input' },
        { id: 'out1', x: endX, y: centerY, radius: 45, color: '#8b5cf6', label: 'AI Prediction', type: 'output' }
    ];
}

function drawNode(node) {
    if (node.type === 'output' && isTraining) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 25);
}

class DataParticle {
    constructor(startX, startY, endX, endY) {
        this.x = startX;
        this.y = startY;
        this.targetX = endX;
        this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.02; 
        this.progress = 0; 
    }

    update() {
        this.progress += this.speed;
        this.x = this.x + (this.targetX - this.x) * this.speed;
        this.y = this.y + (this.targetY - this.y) * this.speed;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#27c93f'; 
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#27c93f';
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0; 

    connections.forEach(conn => {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = isTraining ? '#27c93f' : 'rgba(139, 92, 246, 0.5)';
        ctx.lineWidth = 6;
        ctx.stroke();
    });

    if (draggingFromNode) {
        ctx.beginPath();
        ctx.moveTo(draggingFromNode.x, draggingFromNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (isTraining) {
        if (Math.random() > 0.6) {
            let randomConn = connections[Math.floor(Math.random() * connections.length)];
            dataParticles.push(new DataParticle(randomConn.from.x, randomConn.from.y, randomConn.to.x, randomConn.to.y));
        }

        for (let i = dataParticles.length - 1; i >= 0; i--) {
            let p = dataParticles[i];
            p.update();
            p.draw();
            if (p.progress >= 1) {
                dataParticles.splice(i, 1);
            }
        }
    }

    nodes.forEach(drawNode);
    requestAnimationFrame(draw);
}

function getHoveredNode(x, y) {
    return nodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= node.radius + 10; 
    });
}

canvas.addEventListener('mousedown', (e) => {
    if (isTraining) return; 
    const rect = canvas.getBoundingClientRect();
    const clickedNode = getHoveredNode(e.clientX - rect.left, e.clientY - rect.top);
    if (clickedNode && clickedNode.type === 'input') {
        draggingFromNode = clickedNode;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mouseup', () => {
    if (draggingFromNode) {
        const targetNode = getHoveredNode(mouseX, mouseY);
        if (targetNode && targetNode.type === 'output') {
            const exists = connections.some(c => c.from.id === draggingFromNode.id);
            if (!exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                checkWinCondition();
            }
        }
        draggingFromNode = null;
    }
});

function checkWinCondition() {
    connectionCountTxt.innerText = `${connections.length} / 2`;
    connectionCountTxt.style.color = '#27c93f';
    
    if (connections.length === 2) {
        trainBtn.disabled = false;
        systemMessage.innerText = "Architecture Complete. Ready to train.";
        systemMessage.className = "message success";
    }
}

trainBtn.addEventListener('click', () => {
    isTraining = true;
    trainBtn.disabled = true;
    trainBtn.innerText = "Training...";
    metricsPanel.style.display = "block";
    systemMessage.innerText = "Forward propagation initialized...";
    
    let epoch = 0;
    let acc = 12;
    let loss = 1.00;

    const trainingInterval = setInterval(() => {
        epoch += 1;
        acc += Math.floor(Math.random() * 3);
        loss -= (Math.random() * 0.02);

        if (acc > 94) acc = 94;
        if (loss < 0.1) loss = 0.12;

        epochTxt.innerText = epoch;
        accuracyTxt.innerText = `${acc}%`;
        lossTxt.innerText = loss.toFixed(2);

        if (epoch >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = []; 
            
            setTimeout(async () => {
                modal.classList.remove('hidden'); 
                await updateProgress(1, 2); 
            }, 500);
        }
    }, 100); 
});

resizeCanvas();
draw();