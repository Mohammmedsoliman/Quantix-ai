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
        { id: 'act_wall', x: col1, y: centerY - 100, radius: 35, color: '#94a3b8', label: 'Action: Hit Wall', type: 'action' },
        { id: 'act_move', x: col1, y: centerY + 100, radius: 35, color: '#94a3b8', label: 'Action: Move Fwd', type: 'action' },
        { id: 'sig_bad', x: col2, y: centerY - 100, radius: 35, color: '#ff5f56', label: 'Penalty (-1)', type: 'signal' },
        { id: 'sig_good', x: col2, y: centerY + 100, radius: 35, color: '#27c93f', label: 'Reward (+1)', type: 'signal' },
        { id: 'agent', x: col3, y: centerY, radius: 45, color: '#ec4899', label: '🤖 RL Agent', type: 'output' }
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
        ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.shadowBlur = 12; ctx.shadowColor = this.color;
    }
}

function drawNode(node) {
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
            let isValid = (draggingFromNode.type === 'action' && targetNode.type === 'signal') || 
                          (draggingFromNode.type === 'signal' && targetNode.type === 'output');
            
            const exists = connections.some(c => c.from.id === draggingFromNode.id && c.to.id === targetNode.id);
            
            if (isValid && !exists) {
                connections = connections.filter(c => c.from.id !== draggingFromNode.id);
                connections.push({ from: draggingFromNode, to: targetNode });
                
                let actsMapped = connections.filter(c => c.from.type === 'action').length === 2;
                let sigsReach = connections.some(c => c.to.id === 'agent');
                
                if (actsMapped && sigsReach) {
                    trainBtn.disabled = false;
                    systemMessage.innerText = "Feedback loop established.";
                    document.getElementById('connection-count').innerText = "Online";
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
    systemMessage.innerText = "Agent exploring environment...";
    
    let wallToReward = connections.some(c => c.from.id === 'act_wall' && c.to.id === 'sig_good');
    let moveToPenalty = connections.some(c => c.from.id === 'act_move' && c.to.id === 'sig_bad');
    let wallToPenalty = connections.some(c => c.from.id === 'act_wall' && c.to.id === 'sig_bad');
    let moveToReward = connections.some(c => c.from.id === 'act_move' && c.to.id === 'sig_good');
    
    let penaltyReaches = connections.some(c => c.from.id === 'sig_bad' && c.to.id === 'agent');
    let rewardReaches = connections.some(c => c.from.id === 'sig_good' && c.to.id === 'agent');

    let isSuccess = wallToPenalty && moveToReward && penaltyReaches && rewardReaches;
    let isPsychopath = wallToReward && rewardReaches; 
    let isLazy = moveToPenalty && penaltyReaches; 

    let episode = 0;
    let distance = 0;
    let collisions = 0;

    const trainingInterval = setInterval(() => {
        episode++;
        
        if (isSuccess) {
            distance += Math.floor(Math.random() * 10) + 15; 
            if (episode < 10) collisions += 1; 
        } else if (isPsychopath) {
            distance += Math.floor(Math.random() * 2); 
            collisions += Math.floor(Math.random() * 5) + 3; 
        } else if (isLazy) {
            distance += 0; 
            collisions += 0; 
        } else {
            distance += Math.floor(Math.random() * 5);
            collisions += Math.floor(Math.random() * 2);
        }
        
        document.getElementById('epoch-count').innerText = episode;
        document.getElementById('accuracy-score').innerText = `${distance}m`;
        
        let colText = document.getElementById('loss-score');
        colText.innerText = collisions;
        
        if (episode > 15) {
            if (isSuccess) {
                document.getElementById('accuracy-score').style.color = '#27c93f';
                colText.style.color = '#27c93f';
            } else if (isPsychopath) {
                colText.style.color = '#ff5f56';
                colText.classList.add('training-text'); 
            } else if (isLazy) {
                document.getElementById('accuracy-score').style.color = '#ffbd2e'; 
            }
        }

        if (episode >= 50) {
            clearInterval(trainingInterval);
            isTraining = false;
            dataParticles = [];
            
            setTimeout(async () => {
                if (isSuccess) {
                    modalSuccess.classList.remove('hidden');
                    await updateProgress(9, 10); 
                } else {
                    if (isPsychopath) {
                        failReasonTxt.innerHTML = "You wired the 'Hit Wall' action to the 'Reward (+1)' signal! <br><br>The AI realized that crashing gives it points. It actively rammed itself into the walls until it broke.";
                    } else if (isLazy) {
                        failReasonTxt.innerHTML = "You wired 'Move Forward' to a 'Penalty (-1)'! <br><br>The AI learned that trying to navigate causes pain, so it decided to sit perfectly still and do nothing.";
                    } else {
                        failReasonTxt.innerHTML = "The signals didn't reach the brain properly. The robot stumbled around blindly.";
                    }
                    modalFail.classList.remove('hidden');
                }
            }, 800);
        }
    }, 80);
});

resizeCanvas();
draw();