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
const phaseLabel = document.getElementById('phase-label');
const epochTxt = document.getElementById('epoch-count');
const trainAccTxt = document.getElementById('train-acc');
const testAccTxt = document.getElementById('test-acc');

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
let isTesting = false;

function initNodes() {
    const col1 = canvas.width * 0.15;
    const col2 = canvas.width * 0.40;
    const col3 = canvas.width * 0.65;
    const col4 = canvas.width * 0.85;
    const centerY = canvas.height / 2;

    nodes = [
        { id: 'in1', x: col1, y: centerY, radius: 30, color: '#06b6d4', label: 'Clean Data', type: 'input' },
        { id: 'hid1', x: col2, y: centerY - 100, radius: 30, color: '#ff3366', label: 'Hidden (Complex)', type: 'hidden' },
        { id: 'hid2', x: col2, y: centerY + 100, radius: 30, color: '#ff3366', label: 'Hidden (Complex)', type: 'hidden' },
        { id: 'dropout', x: col3, y: centerY, radius: 35, color: '#f59e0b', label: 'Dropout 50%', type: 'regularizer' },
        { id: 'out1', x: col4, y: centerY, radius: 45, color: '#8b5cf6', label: 'AI Prediction', type: 'output' }
    ];
}

class DataParticle {
    constructor(startX, startY, endX, endY, phase) {
        this.x = startX; this.y = startY;
        this.targetX = endX; this.targetY = endY;
        this.speed = 0.02 + Math.random() * 0.02;
        this.progress = 0;
        this.color = phase === 'test' ? '#06b6d4' : '#27c93f'; 
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        
        if (isTraining) ctx.strokeStyle = 'rgba(39, 201, 63, 0.6)';
        if (isTesting) ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        
        ctx.lineWidth = 5; ctx.stroke();
    });

    if (draggingFromNode) {
        ctx.beginPath();
        ctx.moveTo(draggingFromNode.x, draggingFromNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = draggingFromNode.color;
        ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (isTraining || isTesting) {
        let currentPhase = isTesting ? 'test' : 'train';
        if (Math.random() > 0.4 && connections.length > 0) {
            let conn = connections[Math.floor(Math.random() * connections.length)];
            dataParticles.push(new DataParticle(conn.from.x, conn.from.y, conn.to.x, conn.to.y, currentPhase));
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
    if (isTraining || isTesting) return;
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
                trainBtn.disabled = false;
                systemMessage.innerText = "Architecture locked. Ready.";
            }
        }
        draggingFromNode = null;
    }
});

trainBtn.addEventListener('click', () => {
    isTraining = true;
    trainBtn.disabled = true;
    metricsPanel.style.display = "block";
    systemMessage.innerText = "Learning practice data...";
    
    let usedDropout = connections.some(c => c.to.id === 'dropout' || c.from.id === 'dropout');
    
    let epoch = 0;
    let trainAcc = 10;
    let testAcc = 10;

    const trainingInterval = setInterval(() => {
        epoch++;
        
        let targetTrainAcc = usedDropout ? 88 : 99;
        trainAcc += (targetTrainAcc - trainAcc) * 0.15; 
        
        epochTxt.innerText = epoch;
        trainAccTxt.innerText = `${Math.floor(trainAcc)}%`;

        if (epoch >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            setTimeout(startTestingPhase, 1000);
        }
    }, 60);

    function startTestingPhase() {
        isTesting = true;
        phaseLabel.innerText = "TESTING UNSEEN DATA...";
        phaseLabel.style.color = "#ffbd2e";
        systemMessage.innerText = "Running against exam data...";
        testAccTxt.style.color = "#fff";
        dataParticles = []; 

        let testEpoch = 0;

        const testingInterval = setInterval(() => {
            testEpoch++;
            
            let targetTestAcc = usedDropout ? 85 : 38;
            testAcc += (targetTestAcc - testAcc) * 0.15; 
            
            testAccTxt.innerText = `${Math.floor(testAcc)}%`;

            if (!usedDropout && testEpoch > 15) {
                testAccTxt.style.color = '#ff5f56'; 
            } else if (usedDropout && testEpoch > 15) {
                testAccTxt.style.color = '#27c93f'; 
            }

            if (testEpoch >= 50) {
                clearInterval(testingInterval);
                isTesting = false;
                dataParticles = [];
                
                setTimeout(async () => {
                    if (usedDropout) {
                        document.getElementById('success-modal').classList.remove('hidden');
                        await updateProgress(4, 5);
                    } else {
                        document.getElementById('fail-modal').classList.remove('hidden');
                    }
                }, 800);
            }
        }, 60);
    }
});

resizeCanvas();
draw();