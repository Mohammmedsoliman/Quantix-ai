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
let memoryLoopAngle = 0; 

function initNodes() {
    const col1 = canvas.width * 0.15;
    const col2 = canvas.width * 0.50;
    const col3 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'seq_in', x: col1, y: centerY, radius: 40, color: '#06b6d4', label: '📊 30-Day History', type: 'input' },
        { id: 'dense', x: col2, y: centerY - 120, radius: 35, color: '#ff3366', label: '🧠 Standard Dense', type: 'hidden' },
        { id: 'lstm', x: col2, y: centerY + 120, radius: 45, color: '#f59e0b', label: '🔄 LSTM (Memory)', type: 'hidden' },
        { id: 'out1', x: col3, y: centerY, radius: 45, color: '#8b5cf6', label: '🎯 Future Forecast', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, isMemory) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.015 + Math.random() * 0.015;
        this.progress = 0;
        this.color = isMemory ? '#f59e0b' : '#06b6d4'; 
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
    if (node.id === 'lstm' && isTraining) {
        memoryLoopAngle += 0.1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 15, memoryLoopAngle, memoryLoopAngle + Math.PI, false);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 25, -memoryLoopAngle, -memoryLoopAngle + Math.PI, false);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 25);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    connections.forEach(conn => {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = isTraining ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
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
            let isMemory = conn.from.id === 'lstm' || conn.to.id === 'lstm';
            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, isMemory));
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
        
        if (targetNode && targetNode.id !== draggingFromNode.id) {
            let isValidForward = (draggingFromNode.type === 'input' && targetNode.type === 'hidden') || 
                                 (draggingFromNode.type === 'hidden' && targetNode.type === 'output');
            
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);
            
            if (isValidForward && !exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                
                let outHasIn = connections.some(c => c.to.type === 'output');
                let inHasOut = connections.some(c => c.from.type === 'input');
                
                if (outHasIn && inHasOut) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Sequence complete. Ready to forecast.";
                    document.getElementById('connection-count').innerText = "Locked";
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
    systemMessage.innerText = "Analyzing historical data...";
    
    let usedDense = connections.some(c => c.to.id === 'dense' || c.from.id === 'dense');
    let usedLSTM = connections.some(c => c.to.id === 'lstm' || c.from.id === 'lstm');
    
    let isSuccess = usedLSTM && !usedDense;
    
    let day = 0;
    let retention = 10;
    let errorRate = 100;

    const trainingInterval = setInterval(() => {
        day++;
        
        if (usedDense) {
            retention = Math.random() * 20; 
            errorRate -= (85 - errorRate) * 0.1; 
        } else {
            retention += (98 - retention) * 0.1; 
            errorRate -= (12 - errorRate) * 0.1; 
        }
        
        document.getElementById('epoch-count').innerText = day;
        document.getElementById('accuracy-score').innerText = `${Math.floor(retention)}%`;
        
        let errorTxt = document.getElementById('loss-score');
        errorTxt.innerText = `${Math.floor(errorRate)} Points`;
        
        if (day > 10) {
            if (isSuccess) {
                document.getElementById('accuracy-score').style.color = '#27c93f';
                errorTxt.style.color = '#27c93f';
            } else {
                document.getElementById('accuracy-score').style.color = '#ff5f56';
                errorTxt.style.color = '#ff5f56';
            }
        }

        if (day >= 30) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (isSuccess) {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(8, 9); 
                } else {
                    modalFail.classList.remove('hidden');
                }
            }, 800);
        }
    }, 100);
});

resizeCanvas();
draw();