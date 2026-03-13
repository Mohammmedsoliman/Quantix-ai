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
const noiseImg = document.getElementById('gen-image-noise');
const clearImg = document.getElementById('gen-image-clear');

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
    const col1 = canvas.width * 0.20;
    const col2 = canvas.width * 0.50;
    const col3 = canvas.width * 0.80;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'src_noise', x: col1, y: centerY - 120, radius: 30, color: '#94a3b8', label: '🎲 Random Noise', type: 'source' },
        { id: 'src_real', x: col1, y: centerY + 120, radius: 30, color: '#06b6d4', label: '🖼️ Real Images', type: 'source' },
        { id: 'net_gen', x: col2, y: centerY - 80, radius: 45, color: '#ec4899', label: '👨‍🎨 Generator (Forger)', type: 'network' },
        { id: 'net_disc', x: col3, y: centerY + 50, radius: 45, color: '#8b5cf6', label: '🕵️‍♂️ Discriminator (Detective)', type: 'network' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, type) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.01;
        this.progress = 0;
        this.type = type; 
    }
    update() {
        this.progress += this.speed;
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
    }
    draw() {
        let color = '#94a3b8'; 
        if (this.type === 'real') color = '#06b6d4'; 
        if (this.type === 'fake') color = '#ec4899'; 

        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.shadowBlur = 8; ctx.shadowColor = color;
    }
}

function drawNode(node) {
    if (node.id === 'net_gen' && isTraining) {
         ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + 10 + Math.sin(Date.now()/200)*5, 0, Math.PI * 2);
         ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 25);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    connections.forEach(conn => {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = isTraining ? conn.from.color : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4; ctx.stroke();
    });

    if (draggingFromNode) {
        ctx.beginPath();
        ctx.moveTo(draggingFromNode.x, draggingFromNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = draggingFromNode.color;
        ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (isTraining) {
        if (Math.random() > 0.2 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            
            let particleType = 'noise';
            if (conn.from.id === 'src_real') particleType = 'real';
            if (conn.from.id === 'net_gen') particleType = 'fake';

            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, particleType));
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
    if (clickedNode) draggingFromNode = clickedNode;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mouseup', () => {
    if (draggingFromNode) {
        const targetNode = getHoveredNode(mouseX, mouseY);
        
        if (targetNode && targetNode.id !== draggingFromNode.id) {
            let isValid = false;
            if (draggingFromNode.id === 'src_noise' && targetNode.id === 'net_gen') isValid = true;
            if (draggingFromNode.id === 'src_real' && targetNode.id === 'net_disc') isValid = true;
            if (draggingFromNode.id === 'net_gen' && targetNode.id === 'net_disc') isValid = true;

            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);
            
            if (isValid && !exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                
                let hasNoiseToGen = connections.some(c => c.from.id === 'src_noise' && c.to.id === 'net_gen');
                let hasRealToDisc = connections.some(c => c.from.id === 'src_real' && c.to.id === 'net_disc');
                let hasGenToDisc = connections.some(c => c.from.id === 'net_gen' && c.to.id === 'net_disc');
                
                if (hasNoiseToGen && hasRealToDisc && hasGenToDisc) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Adversarial loop ready. Begin battle.";
                    document.getElementById('connection-count').innerText = "Locked & Loaded";
                    document.getElementById('connection-count').style.color = "#27c93f";
                } else {
                     systemMessage.innerText = "Architecture incomplete. Both networks need data.";
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
    systemMessage.innerText = "Networks are fighting...";
    
    let hasRealToDisc = connections.some(c => c.from.id === 'src_real' && c.to.id === 'net_disc');
    let hasGenToDisc = connections.some(c => c.from.id === 'net_gen' && c.to.id === 'net_disc');
    let isSuccess = hasRealToDisc && hasGenToDisc; 

    let epoch = 0;
    let genLoss = 10.0; 
    let discLoss = 0.1; 

    const trainingInterval = setInterval(() => {
        epoch++;
        
        if (isSuccess) {
            genLoss += (0.6 - genLoss) * 0.05;
            discLoss += (0.4 - discLoss) * 0.05;
            genLoss += (Math.random() - 0.5) * 0.1;
            discLoss += (Math.random() - 0.5) * 0.1;
            
            let progress = epoch / 100;
            noiseImg.style.opacity = 1 - progress;
            clearImg.style.opacity = progress;
            
        } else {
            discLoss = 0.01; 
            genLoss = 20.0; 
            noiseImg.style.opacity = 1;
            clearImg.style.opacity = 0;
        }
        
        document.getElementById('epoch-count').innerText = epoch;
        document.getElementById('gen-loss').innerText = genLoss.toFixed(2);
        document.getElementById('disc-loss').innerText = discLoss.toFixed(2);
        
        if (epoch >= 100) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (isSuccess) {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(10, 11); 
                } else {
                    if (!hasRealToDisc) {
                         failReasonTxt.innerHTML = "You forgot to feed <strong>Real Images</strong> to the Detective! It had nothing to compare the fakes against.";
                    } else if (!hasGenToDisc) {
                         failReasonTxt.innerHTML = "You didn't connect the Forger to the Detective! They couldn't fight, so no one learned anything.";
                    }
                    modalFail.classList.remove('hidden');
                }
            }, 1000);
        }
    }, 100); 
});

resizeCanvas();
draw();