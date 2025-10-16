// =========================================================
// Configuration and Constants
// =========================================================
const N = 50;
const INDIAN_BANK_NAMES = [
    "State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank", "Bank of Baroda",
    "Union Bank of India", "Canara Bank", "Axis Bank", "Kotak Mahindra Bank", "IndusInd Bank",
    "Indian Bank", "Central Bank of India", "Bank of India", "Indian Overseas Bank", "UCO Bank",
    "IDBI Bank", "Yes Bank", "Federal Bank", "RBL Bank", "IDFC First Bank",
    "South Indian Bank", "J&K Bank", "Karur Vysya Bank", "Dhanlaxmi Bank", "City Union Bank",
    "Bandhan Bank", "Au Small Finance Bank", "Equitas Small Finance Bank", "CSB Bank", "DCB Bank",
    "Suryoday Small Finance Bank", "TMB", "CanaFin Homes", "HDFC LTD", "PNB Housing",
    "LIC Housing Finance", "IIFL Finance", "Shriram Transport Finance", "Muthoot Finance", "Bajaj Finance",
    "Bank A", "Bank B", "Bank C", "Bank D", "Bank E",
    "Bank F", "Bank G", "Bank H", "Bank I", "Bank J"
];

// Simulation Constants
const MACRO_LOSS_FACTOR = 0.20;
const MIN_CAPITAL_RATIO = 0.08;
const MAX_CAPITAL_RATIO = 0.15;
const ASSETS_MIN = 1000;
const ASSETS_MAX = 5000;
const DEBT_RANK_TOLERANCE = 0.0001;
const MAX_ITERATIONS = 100;

// Utility functions
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.max(0, amount));
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// Color scale based on stress level
const getColor = (level) => {
    if (level === 2) return '#ef4444'; // Failed (Red-500)
    if (level === 1) return '#facc15'; // Stressed (Yellow-400)
    return '#22c55e'; // Healthy (Green-500)
};

// =========================================================
// Main Stress Tester Module (Object-Oriented Approach)
// =========================================================
const StressTester = (() => {
    let network = { nodes: [], links: [], adj: [] };
    let totalInitialCapital = 0;
    let selectedBankId = null;

    // D3 variables
    let forceSimulation = null;
    let linkElements = null;
    let nodeElements = null;
    let radiusScale = null;
    let svg = null;
    let networkContainer = null;
    let width = 900;
    let height = 580;

    // DOM Elements
    const DOM = {
        simulateBtn: document.getElementById('simulateBtn'),
        shockType: document.getElementById('shockType'),
        targetedBankControl: document.getElementById('targetedBankControl'),
        targetedBankId: document.getElementById('targetedBankId'),
        metricsBody: document.getElementById('metricsBody'),
        modalOverlay: document.getElementById('bankDetailsModal'),
        bankDetailsContent: document.getElementById('bankDetailsContent'),
        networkPlaceholder: document.getElementById('network-placeholder')
    };

    // ----------------------
    // D3 Helper Functions
    // ----------------------

    const dragStarted = (event, d) => {
        if (!event.active) forceSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
    };

    const dragEnded = (event) => {
        if (!event.active) forceSimulation.alphaTarget(0);
        // We keep fx/fy null-ed out in this version to let the force simulation continue
    };

    const ticked = () => {
        if (linkElements) {
            linkElements
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
        }

        if (nodeElements) {
            nodeElements
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        }

        // Update labels
        svg.selectAll(".labels text")
            .attr("x", d => d.x)
            .attr("y", d => d.y - radiusScale(d.A) - 2);
    };

    /**
     * Uses ResizeObserver for screen responsiveness.
     * When the container size changes (e.g., window resize, mobile orientation change), 
     * it updates the SVG viewBox and restarts the D3 simulation gracefully.
     */
    const setupResizeObserver = () => {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target.id === 'network-container') {
                    const newWidth = entry.contentRect.width;
                    const newHeight = entry.contentRect.height;

                    if (newWidth !== width || newHeight !== height) {
                        width = newWidth;
                        height = newHeight;

                        svg.attr("viewBox", `0 0 ${width} ${height}`);

                        if (network.nodes.length && forceSimulation) {
                            // Update the center force to the new dimensions
                            forceSimulation.force("center", d3.forceCenter(width / 2, height / 2));
                            // Gently restart the simulation to reposition the nodes
                            forceSimulation.alpha(0.1).restart();
                        }
                    }
                }
            }
        });

        // Start observing the network container
        resizeObserver.observe(networkContainer);
    };

    const renderNetwork = (isInitial) => {
        const { nodes, links } = network;

        if (isInitial) {
            svg.selectAll("*").remove();
            svg.attr("viewBox", `0 0 ${width} ${height}`);

            radiusScale = d3.scaleSqrt()
                .domain([d3.min(nodes, d => d.A), d3.max(nodes, d => d.A)])
                .range([6, 25]);

            // 1. Force Simulation Setup
            forceSimulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(70).strength(0.2))
                .force("charge", d3.forceManyBody().strength(-400))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .on("tick", ticked);

            // 2. Draw Links (Edges)
            linkElements = svg.append("g")
                .attr("stroke-opacity", 0.4)
                .selectAll("line")
                .data(links)
                .join("line")
                .attr("class", "link")
                .attr("stroke-width", d => Math.sqrt(d.value) * 0.1)
                .attr("stroke", '#475569');

            // 3. Draw Nodes
            nodeElements = svg.append("g")
                .attr("stroke-width", 3)
                .selectAll("circle")
                .data(nodes)
                .join("circle")
                .attr("class", "node")
                .attr("r", d => radiusScale(d.A))
                .attr("fill", d => getColor(d.stressLevel))
                .attr("stroke", '#0f172a')
                .attr("data-bank-id", d => d.id)
                .call(d3.drag()
                    .on("start", dragStarted)
                    .on("drag", dragged)
                    .on("end", dragEnded))
                .on("mouseover", showTooltip)
                .on("mouseout", hideTooltip)
                .on("click", (event, d) => selectBank(d.id));

            // 4. Draw Labels (for larger institutions only)
            svg.append("g")
                .attr("class", "labels")
                .selectAll("text")
                .data(nodes.filter(d => d.A > (ASSETS_MAX + ASSETS_MIN) / 2))
                .join("text")
                .text(d => d.name.split(' ')[0])
                .attr("fill", '#e2e8f0')
                .attr("font-size", "11px")
                .attr("font-weight", "600")
                .attr("text-anchor", "middle")
                .attr("pointer-events", "none");

        } else {
            // Update Existing Visualization (Post-Shock)
            updateMetricsDashboard(false);

            // Update Links: smooth transition
            linkElements.transition().duration(800)
                .attr("stroke", d => {
                    const sourceNode = nodes.find(n => n.id === d.source.id || n.id === d.source);
                    const targetNode = nodes.find(n => n.id === d.target.id || n.id === d.target);
                    const isStressed = (sourceNode && (sourceNode.isFailed || sourceNode.stressLevel === 1)) || 
                                       (targetNode && (targetNode.isFailed || targetNode.stressLevel === 1));
                    return isStressed ? '#06b6d4' : '#475569';
                })
                .attr("stroke-width", d => {
                    const sourceRank = nodes.find(n => n.id === d.source.id || n.id === d.source)?.debtRank || 0;
                    return Math.sqrt(d.value) * 0.1 * clamp((1 + sourceRank * 2), 1, 3);
                });

            // Update Nodes: smooth transition
            nodeElements.data(nodes)
                .transition().duration(1000)
                .attr("fill", d => getColor(d.stressLevel))
                .attr("stroke", d => d.id === selectedBankId ? '#ffb300' : (d.isFailed ? '#f87171' : '#0f172a'))
                .attr("stroke-width", d => d.id === selectedBankId ? 5 : (d.isFailed ? 4 : 3))
                .attr("r", d => radiusScale(d.A) * (d.isFailed ? 1.2 : 1.0));
        }
    };

    // ----------------------
    // Modal Functions
    // ----------------------
    const openModal = () => DOM.modalOverlay.classList.add('open');
    const closeModal = (event) => {
        if (!event || event.target.id === 'bankDetailsModal' || event.target.tagName === 'BUTTON' || event.target.closest('button')) {
            DOM.modalOverlay.classList.remove('open');
        }
    };

    const updateDetailsPanel = (node) => {
        if (!node) return;

        const { adj } = network;
        // Count connections using the adjacency matrix (professional approach)
        const inConnections = adj.reduce((sum, row) => sum + (row[node.id] > 0 ? 1 : 0), 0);
        const outConnections = adj[node.id].filter(val => val > 0).length;

        const statusClass = node.stressLevel === 2 ? 'text-red-500 font-bold' : (node.stressLevel === 1 ? 'text-yellow-400' : 'text-green-400');
        const statusText = node.stressLevel === 2 ? 'FAILED' : (node.stressLevel === 1 ? 'STRESSED' : 'HEALTHY');

        const formatConnections = (type) => {
            let html = '';
            for (let i = 0; i < N; i++) {
                const value = (type === 'inbound') ? adj[i][node.id] : adj[node.id][i];
                if (value > 0) {
                    html += `<li class="flex justify-between text-slate-400 mono text-xs"><span>${network.nodes[i].name}:</span> <span>${formatCurrency(value)}</span></li>`;
                }
            }
            return html || '<li class="text-slate-500 text-xs">None.</li>';
        };

        DOM.bankDetailsContent.innerHTML = `
            <h3 class="text-2xl sm:text-3xl font-bold text-cyan-200 mb-2">${node.name} (ID: ${node.id})</h3>
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                <span class="text-lg font-semibold text-slate-300">Current Status:</span>
                <span class="text-xl ${statusClass} tracking-widest">${statusText}</span>
            </div>
            <div class="space-y-2 text-base">
                <div class="grid grid-cols-2 gap-x-4">
                    <div class="flex flex-col sm:flex-row justify-between">
                        <span class="text-slate-400">Total Assets (A):</span>
                        <span class="font-bold text-slate-300 mono">${formatCurrency(node.A)}</span>
                    </div>
                    <div class="flex flex-col sm:flex-row justify-between">
                        <span class="text-slate-400">Initial Capital (E₀):</span>
                        <span class="font-bold text-green-400 mono">${formatCurrency(node.E_initial)}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-x-4">
                    <div class="flex flex-col sm:flex-row justify-between">
                        <span class="text-slate-400">Claims (A_IB):</span>
                        <span class="font-bold text-cyan-400 mono">${formatCurrency(node.A_interbank)}</span>
                    </div>
                    <div class="flex flex-col sm:flex-row justify-between">
                        <span class="text-slate-400">Liabilities (L_IB):</span>
                        <span class="font-bold text-cyan-400 mono">${formatCurrency(node.L_interbank)}</span>
                    </div>
                </div>
                <div class="flex justify-between pt-2 border-t border-slate-800">
                    <span class="text-slate-300 font-semibold">Post-Shock Capital (E):</span>
                    <span class="font-extrabold text-xl ${node.E <= 0 ? 'text-red-500' : 'text-green-400'} mono">${formatCurrency(node.E)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-300 font-semibold">DebtRank:</span>
                    <span class="font-extrabold text-xl ${node.debtRank > 0.4 ? 'text-red-400' : 'text-yellow-400'}">${node.debtRank.toFixed(4)}</span>
                </div>
            </div>

            <h4 class="text-lg font-semibold text-slate-300 mt-6 border-b border-slate-800 pb-1">Inbound Claims (Owed **to** this bank - ${inConnections}):</h4>
            <ul class="space-y-1 max-h-32 overflow-y-auto pr-2">${formatConnections('inbound')}</ul>

            <h4 class="text-lg font-semibold text-slate-300 mt-4 border-b border-slate-800 pb-1">Outbound Liabilities (Owed **by** this bank - ${outConnections}):</h4>
            <ul class="space-y-1 max-h-32 overflow-y-auto pr-2">${formatConnections('outbound')}</ul>
        `;
    };

    // ----------------------
    // Simulation Core Logic
    // ----------------------

    const generateNetwork = () => {
        const nodes = [];
        totalInitialCapital = 0;
        const shuffledNames = d3.shuffle(INDIAN_BANK_NAMES.slice(0, N));

        for (let i = 0; i < N; i++) {
            const totalAssets = Math.random() * (ASSETS_MAX - ASSETS_MIN) + ASSETS_MIN;
            const capitalRatio = Math.random() * (MAX_CAPITAL_RATIO - MIN_CAPITAL_RATIO) + MIN_CAPITAL_RATIO;

            const E = totalAssets * capitalRatio;
            const L = totalAssets - E;
            totalInitialCapital += E;

            nodes.push({
                id: i,
                name: shuffledNames[i] || `Bank ${i+1}`,
                A: totalAssets,
                E_initial: E,
                E: E,
                L: L,
                isFailed: false,
                debtRank: 0,
                stressLevel: 0,
                L_interbank: 0,
                A_interbank: 0,
            });
        }

        const adj = Array(N).fill(0).map(() => Array(N).fill(0));
        const links = [];

        // 2. Determine Interbank Liabilities and build adjacency matrix
        nodes.forEach(debtor => {
            const totalIBL = debtor.L * (0.15 + Math.random() * 0.15);
            debtor.L_interbank = totalIBL;
            let assignedLiability = 0;

            const numCreditors = Math.floor(Math.random() * 4) + 1;
            const potentialCreditors = nodes.filter(n => n.id !== debtor.id);

            d3.shuffle(potentialCreditors).slice(0, numCreditors).forEach(creditor => {
                let liabilityShare = totalIBL * (Math.random() * 0.4 + 0.1);
                liabilityShare = Math.min(liabilityShare, totalIBL - assignedLiability);

                if (liabilityShare > 0) {
                    adj[debtor.id][creditor.id] = liabilityShare;
                    assignedLiability += liabilityShare;
                }
            });
        });

        // 3. Calculate Interbank Assets and Finalize Links
        nodes.forEach(node => {
            node.A_interbank = 0;
            for (let j = 0; j < N; j++) {
                node.A_interbank += adj[j][node.id];
                if (adj[node.id][j] > 0) {
                    links.push({ source: node.id, target: j, value: adj[node.id][j] });
                }
            }
            node.A_external = node.A - node.A_interbank;
        });

        network = { nodes, links, adj };
        renderNetwork(true);
        DOM.simulateBtn.disabled = false;
        DOM.networkPlaceholder.classList.add('hidden');
        populateTargetedBankControl();
        closeModal();
        selectedBankId = null;
        
        // FIX: Ensure metrics dashboard is updated immediately after network generation
        updateMetricsDashboard(true); 
    };

    const runSimulation = () => {
        // Human-readable code: use object destructuring and avoid mutating the original array directly
        const { nodes: initialNodes, adj } = network;
        const nodes = initialNodes.map(n => ({ ...n, E: n.E_initial, isFailed: false, debtRank: 0, stressLevel: 0 }));
        const shockType = DOM.shockType.value;
        const initialRanks = nodes.map(n => 0);

        // 1. Apply Initial Shock (Phase 1)
        nodes.forEach(node => {
            if (shockType === 'macro') {
                node.E -= node.A_external * MACRO_LOSS_FACTOR;
            } else if (shockType === 'targeted' && node.id === parseInt(DOM.targetedBankId.value)) {
                node.E = -1; // Force failure for targeted bank
            } else if (shockType === 'random' && Math.random() < 0.1) {
                node.E -= node.E_initial * 0.8;
            }

            if (node.E <= 0) {
                node.isFailed = true;
                node.stressLevel = 2;
                node.debtRank = 1.0;
            } else {
                const initialRank = clamp(1 - (node.E / node.E_initial), 0, 1);
                node.debtRank = initialRank;
                if (node.debtRank >= 0.5) node.stressLevel = 1;
            }
            initialRanks[node.id] = node.debtRank;
        });

        // 2. Cascading Failure Iteration (DebtRank - Phase 2)
        let iterations = 0;
        let hasConverged = false;
        let previousRanks = [...initialRanks];

        while (!hasConverged && iterations < MAX_ITERATIONS) {
            iterations++;
            hasConverged = true;
            let totalDebtRankChange = 0;
            const currentRanks = nodes.map(n => n.debtRank);

            // Iterate over all banks (creditors)
            for (let j = 0; j < N; j++) { 
                if (nodes[j].debtRank < 1.0) {
                    let propagatedLossRatio = 0;

                    // Sum losses propagated by debtors (i) to creditor (j)
                    for (let i = 0; i < N; i++) { 
                        const L_ij = adj[i][j];
                        if (L_ij > 0 && nodes[i].L_interbank > 0) {
                            const weight = L_ij / nodes[i].L_interbank;
                            const deltaH = currentRanks[i] - previousRanks[i]; // Change in debtor's stress
                            propagatedLossRatio += weight * deltaH;
                        }
                    }

                    // DebtRank formula update
                    const rankIncrease = (1 - nodes[j].debtRank) * propagatedLossRatio;
                    const newRank = clamp(nodes[j].debtRank + rankIncrease, nodes[j].debtRank, 1.0);

                    // Check for convergence
                    if (Math.abs(newRank - nodes[j].debtRank) > DEBT_RANK_TOLERANCE) {
                        totalDebtRankChange += Math.abs(newRank - nodes[j].debtRank);
                        hasConverged = false;
                    }
                    nodes[j].debtRank = newRank;
                }
            }

            previousRanks = currentRanks;

            // Re-evaluate bank capital and status
            nodes.forEach(node => {
                node.E = node.E_initial * (1 - node.debtRank);
                if (node.E <= 0 || node.debtRank >= 0.9999) {
                    node.isFailed = true;
                    node.stressLevel = 2;
                    node.debtRank = 1.0;
                    node.E = 0;
                } else if (node.debtRank > 0.4) {
                    node.stressLevel = 1;
                } else {
                    node.stressLevel = 0;
                }
            });

            if (totalDebtRankChange < DEBT_RANK_TOLERANCE) {
                hasConverged = true;
            }
        }

        // 3. Finalize and Render
        network.nodes = nodes;
        renderNetwork(false);
        if (DOM.modalOverlay.classList.contains('open') && selectedBankId !== null) {
            updateDetailsPanel(nodes.find(n => n.id === selectedBankId));
        }
    };

    // ----------------------
    // UI/Dashboard Updates
    // ----------------------

    const selectBank = (bankId) => {
        if (!network.nodes.length) return;

        selectedBankId = bankId;
        const selectedNode = network.nodes.find(n => n.id === bankId);
        if (!selectedNode) return;

        updateDetailsPanel(selectedNode);
        openModal();

        // 2. Update D3 Visualization Stroke/Radius (Visual Highlight)
        nodeElements
            .attr("stroke", d => d.id === bankId ? '#ffb300' : (d.isFailed ? '#f87171' : '#0f172a'))
            .attr("stroke-width", d => d.id === bankId ? 5 : (d.isFailed ? 4 : 3))
            .attr("r", d => radiusScale(d.A) * (d.id === bankId ? 1.1 : (d.isFailed ? 1.2 : 1.0)))
            .classed("selected", d => d.id === bankId);

        // 3. Highlight Table Row
        document.querySelectorAll('#metricsBody tr').forEach(row => {
            row.classList.remove('bg-cyan-900/40');
            if (parseInt(row.dataset.bankId) === bankId) {
                row.classList.add('bg-cyan-900/40');
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    };

    const updateMetricsDashboard = (isInitial) => {
        const { nodes } = network;

        const totalFailures = nodes.filter(n => n.isFailed).length;
        const totalPostShockCapital = nodes.reduce((sum, n) => sum + Math.max(0, n.E), 0);
        const totalLoss = totalInitialCapital - totalPostShockCapital;

        const contagionIndex = totalInitialCapital > 0 ? (totalLoss / totalInitialCapital) * 100 : 0;

        document.getElementById('metricTotal').textContent = N;
        document.getElementById('metricFailures').textContent = totalFailures;
        document.getElementById('metricContagion').textContent = `${contagionIndex.toFixed(2)}%`;
        document.getElementById('metricLoss').textContent = formatCurrency(totalLoss);

        // Update Table
        DOM.metricsBody.innerHTML = '';
        nodes.sort((a, b) => b.debtRank - a.debtRank).forEach(node => {
            const inConnections = network.adj.reduce((sum, row) => sum + (row[node.id] > 0 ? 1 : 0), 0);
            const outConnections = network.adj[node.id].filter(val => val > 0).length;

            let statusClass = 'text-green-400';
            let statusText = 'HEALTHY';
            if (node.stressLevel === 2) {
                statusClass = 'text-red-500 font-bold bg-red-900/30 rounded-full px-2';
                statusText = 'FAILED';
            } else if (node.stressLevel === 1) {
                statusClass = 'text-yellow-400 bg-yellow-900/30 rounded-full px-2';
                statusText = 'STRESSED';
            }

            const isSelected = node.id === selectedBankId ? 'bg-cyan-900/40' : '';

            const row = document.createElement('tr');
            row.className = `hover:bg-slate-800 transition-colors cursor-pointer ${isSelected}`;
            row.dataset.bankId = node.id;
            row.innerHTML = `
                <td class="py-3 px-4 mono text-cyan-300 whitespace-nowrap">${node.name} (${node.id})</td>
                <td class="py-3 px-4 mono whitespace-nowrap">${formatCurrency(node.E_initial)}</td>
                <td class="py-3 px-4 mono whitespace-nowrap ${node.E <= 0 ? 'text-red-400 font-bold' : 'text-green-400'}">${formatCurrency(node.E)}</td>
                <td class="py-3 px-4 font-extrabold whitespace-nowrap ${node.debtRank > 0.4 ? 'text-red-400' : 'text-yellow-400'}">${node.debtRank.toFixed(4)}</td>
                <td class="py-3 px-4 whitespace-nowrap"><span class="${statusClass}">${statusText}</span></td>
                <td class="py-3 px-4 text-slate-400 whitespace-nowrap">${inConnections} / ${outConnections}</td>
            `;
            row.addEventListener('click', () => selectBank(node.id));
            DOM.metricsBody.appendChild(row);
        });
    };

    const populateTargetedBankControl = () => {
        DOM.targetedBankId.innerHTML = '';
        network.nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = `${node.name} (ID: ${node.id}) - E: ${formatCurrency(node.E_initial)}`;
            DOM.targetedBankId.appendChild(option);
        });
    };

    // ----------------------
    // Event Handlers
    // ----------------------

    const handleShockTypeChange = (e) => {
        const type = e.target.value;
        if (type === 'targeted') {
            DOM.targetedBankControl.classList.remove('hidden');
        } else {
            DOM.targetedBankControl.classList.add('hidden');
        }

        const shockLabel = e.target.options[e.target.selectedIndex].text;
        DOM.simulateBtn.textContent = `2. Run Stress Test (${shockLabel.split('(')[0].trim()})`;
    };

    const showTooltip = (event, d) => {
        if ('ontouchstart' in window) return;

        const statusText = d.stressLevel === 2 ? 'FAILED' : (d.stressLevel === 1 ? 'STRESSED' : 'HEALTHY');
        let t = d3.select("body").select(".tooltip");
        if(t.empty()) {
            t = d3.select("body").append("div")
                .attr("class", "tooltip absolute px-3 py-2 text-xs text-white card rounded-lg pointer-events-none opacity-0 transition-opacity duration-200 shadow-xl")
                .style("z-index", 100);
        }
        t.transition().duration(200).style("opacity", 1);
        t.html(`
            <div class="font-bold text-base text-cyan-300">${d.name}</div>
            <div class="${d.stressLevel === 2 ? 'text-red-400 font-bold' : d.stressLevel === 1 ? 'text-yellow-400' : 'text-green-400'}">${statusText}</div>
            <div class="mono mt-1">E: ${formatCurrency(d.E)} (Init: ${formatCurrency(d.E_initial)})</div>
            <div class="mt-1 font-semibold text-sm text-cyan-500">DebtRank: ${d.debtRank.toFixed(4)}</div>
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 20) + "px");
    };

    const hideTooltip = () => {
        if ('ontouchstart' in window) return;
        d3.select("body").select(".tooltip").transition().duration(500).style("opacity", 0).remove();
    };

    // ----------------------
    // Initialization
    // ----------------------

    const init = () => {
        // Assign global D3 elements
        svg = d3.select("#network-svg");
        networkContainer = document.getElementById('network-container');

        // Set initial dimensions
        width = networkContainer.offsetWidth;
        height = networkContainer.offsetHeight;

        // Set up Event Listeners
        document.getElementById('generateBtn').addEventListener('click', generateNetwork);
        DOM.simulateBtn.addEventListener('click', runSimulation);
        DOM.shockType.addEventListener('change', handleShockTypeChange);
        DOM.modalOverlay.addEventListener('click', closeModal);

        // Initial UI setup
        DOM.simulateBtn.disabled = true;
        svg.attr("viewBox", `0 0 ${width} ${height}`);
        updateMetricsDashboard(true);
        // This makes the D3 visualization responsive to all screen sizes/rotations
        setupResizeObserver(); 
    };

    // Expose only the necessary methods for external use
    return {
        init: init,
        closeModal: closeModal 
    };

})();

// Initialize the stress tester once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', StressTester.init);

// Make closeModal available globally for the inline onclick handler in app.html
window.closeModal = StressTester.closeModal;