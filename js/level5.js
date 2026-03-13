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
let mouseX = 0; let mouseY = 0;
let isTraining = false;

function initNodes() {
    const col1 = canvas.width * 0.15;
    const col2 = canvas.width * 0.50;
    const col3 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'in_good1', x: col1, y: centerY - 150, radius: 25, color: '#06b6d4', label: 'Packet Payload Size', type: 'input', isGood: true },
        { id: 'in_bad1', x: col1, y: centerY - 50, radius: 25, color: '#ffbd2e', label: 'Server Room Temp', type: 'input', isGood: false },
        { id: 'in_good2', x: col1, y: centerY + 50, radius: 25, color: '#06b6d4', label: 'Failed Logins/Sec', type: 'input', isGood: true },
        { id: 'in_bad2', x: col1, y: centerY + 150, radius: 25, color: '#ffbd2e', label: 'Employee Wardrobe', type: 'input', isGood: false },
        
        { id: 'hid1', x: col2, y: centerY - 80, radius: 35, color: '#ff3366', label: 'Deep Analysis', type: 'hidden' },
        { id: 'hid2', x: col2, y: centerY + 80, radius: 35, color: '#ff3366', label: 'Pattern Matching', type: 'hidden' },
        
        { id: 'out1', x: col3, y: centerY, radius: 45, color: '#8b5cf6', label: 'Threat Detected', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, isBadData) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.02;
        this.progress = 0;
        this.color = isBadData ? '#ff5f56' : '#27c93f'; 
    }
    update() {
        this.progress += this.speed;
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
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
        ctx.strokeStyle = isTraining ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
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
        if (Math.random() > 0.3 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            
            let isBad = false;
            if (conn.from.type === 'input') {
                isBad = !conn.from.isGood;
            } else if (conn.from.type === 'hidden') {
                let sourceConn = connections.find(c => c.to.id === conn.from.id);
                if (sourceConn && sourceConn.from.type === 'input' && !sourceConn.from.isGood) {
                    isBad = true;
                }
            }

            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, isBad));
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
            if (!exists) {
                connections.push({ from: draggingFromNode, to: targetNode });
                connectionCountTxt.innerText = connections.length;
                
                let hasPath = connections.some(c => c.from.type === 'input');
                if (hasPath) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Features selected. Ready.";
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
    systemMessage.innerText = "Monitoring Network Traffic...";
    
    let usedBadFeatures = connections.some(c => c.from.type === 'input' && !c.from.isGood);
    let usedGoodFeatures = connections.some(c => c.from.type === 'input' && c.from.isGood);
    
    let isSuccess = usedGoodFeatures && !usedBadFeatures;
    
    let epoch = 0;
    let acc = 10;
    let falseAlarms = 90;

    let targetAcc = isSuccess ? 96 : 42;
    let targetFalseAlarms = isSuccess ? 2 : 85;

    const trainingInterval = setInterval(() => {
        epoch++;
        
        acc += (targetAcc - acc) * 0.15; 
        falseAlarms += (targetFalseAlarms - falseAlarms) * 0.15;
        
        document.getElementById('epoch-count').innerText = epoch;
        document.getElementById('accuracy-score').innerText = `${Math.floor(acc)}%`;
        
        let faText = document.getElementById('loss-score');
        faText.innerText = `${Math.floor(falseAlarms)}%`;

        if (!isSuccess && epoch > 15) {
            document.getElementById('accuracy-score').style.color = '#ff5f56';
            faText.style.color = '#ff5f56';
        } else if (isSuccess && epoch > 15) {
            document.getElementById('accuracy-score').style.color = '#27c93f';
            faText.style.color = '#27c93f';
        }

        if (epoch >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (isSuccess) {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(5, 6); 
                } else {
                    modalFail.classList.remove('hidden');
                }
            }, 800);
        }
    }, 60);
});

resizeCanvas();
draw();