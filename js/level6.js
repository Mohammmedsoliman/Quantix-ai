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
    const col2 = canvas.width * 0.50;
    const col3 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'cam1', x: col1, y: centerY, radius: 40, color: '#06b6d4', label: '📷 Raw Dashcam', type: 'input' },
        { id: 'filt_blur', x: col2, y: centerY - 120, radius: 35, color: '#f59e0b', label: 'Gaussian Blur', type: 'filter', effect: 'blur' },
        { id: 'filt_edge', x: col2, y: centerY, radius: 35, color: '#27c93f', label: 'Edge Detection', type: 'filter', effect: 'edge' },
        { id: 'filt_inv', x: col2, y: centerY + 120, radius: 35, color: '#ff3366', label: 'Color Invert', type: 'filter', effect: 'invert' },
        { id: 'out1', x: col3, y: centerY, radius: 45, color: '#8b5cf6', label: 'Steering AI', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, color) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.02;
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

    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
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
        if (Math.random() > 0.3 && connections.length > 0) {
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
        if (targetNode && targetNode.id !== draggingFromNode.id) {
            let isValid = (draggingFromNode.type === 'input' && targetNode.type === 'filter') || 
                          (draggingFromNode.type === 'filter' && targetNode.type === 'output');
            
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);
            
            if (isValid && !exists) {
                connections = connections.filter(c => c.from.id !== draggingFromNode.id);
                connections.push({ from: draggingFromNode, to: targetNode });
                
                document.getElementById('connection-count').innerText = "Online";
                document.getElementById('connection-count').style.color = "#27c93f";
                
                let hasFullChain = connections.some(c => c.from.type === 'input') && connections.some(c => c.to.type === 'output');
                if (hasFullChain) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Vision Pipeline established.";
                    systemMessage.className = "message success";
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
    systemMessage.innerText = "Processing Frames...";
    
    let activeFilter = connections.find(c => c.to.type === 'output').from;
    
    let isSuccess = activeFilter.effect === 'edge';
    let isBlur = activeFilter.effect === 'blur';
    let isInvert = activeFilter.effect === 'invert';
    
    let frame = 0;
    let visibility = 10;

    let targetVis = isSuccess ? 98 : (isBlur ? 5 : 45);

    const trainingInterval = setInterval(() => {
        frame++;
        visibility += (targetVis - visibility) * 0.15; 
        
        document.getElementById('epoch-count').innerText = `Frame ${frame}`;
        document.getElementById('accuracy-score').innerText = `${Math.floor(visibility)}%`;
        
        let steerText = document.getElementById('loss-score');
        
        if (frame > 15) {
            if (isSuccess) {
                document.getElementById('accuracy-score').style.color = '#27c93f';
                steerText.innerText = "Stable";
                steerText.style.color = '#27c93f';
            } else {
                document.getElementById('accuracy-score').style.color = '#ff5f56';
                steerText.innerText = isBlur ? "Swerving!" : "Confused!";
                steerText.style.color = '#ff5f56';
            }
        }

        if (frame >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (isSuccess) {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(6, 7);
                } else {
                    if (isBlur) failReasonTxt.innerHTML = "You applied a <strong>Gaussian Blur</strong>! The lane lines completely blended into the road, blinding the AI.";
                    if (isInvert) failReasonTxt.innerHTML = "You <strong>Inverted</strong> the colors! The AI got confused by the negative shadows and drove into a ditch.";
                    modalFail.classList.remove('hidden');
                }
            }, 800);
        }
    }, 60);
});

resizeCanvas();
draw();