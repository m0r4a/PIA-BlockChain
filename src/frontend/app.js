window.onload = async function() {

    const CONFIG = {
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        chainId: '0x7a69',
        chainName: 'Hardhat Local',
        rpcUrl: 'http://127.0.0.1:8545',
        backendUrl: 'http://localhost:8080'
    };

    // Contract ABI
    const CONTRACT_ABI = [
        {
            "inputs": [
                {"internalType": "address", "name": "_student", "type": "address"},
                {"internalType": "string", "name": "_certificateHash", "type": "string"},
                {"internalType": "string", "name": "_institution", "type": "string"}
            ],
            "name": "issueCertificate",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "string", "name": "_certificateHash", "type": "string"}
            ],
            "name": "requestCertificate",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "string", "name": "_certificateHash", "type": "string"}
            ],
            "name": "verifyCertificate",
            "outputs": [
                {"internalType": "bool", "name": "", "type": "bool"},
                {"internalType": "address", "name": "", "type": "address"},
                {"internalType": "string", "name": "", "type": "string"},
                {"internalType": "uint26", "name": "", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "certificateCount",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "address", "name": "", "type": "address"}
            ],
            "name": "admins",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "issueFee",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "requestFee",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    // el estado incial de la app
    let state = {
        provider: null,
        signer: null,
        contract: null,
        account: null,
        isAdmin: false,
        isConnected: false
    };

    // aquí inicia todo
    setupEventListeners();
    await checkWalletConnection();
    updateUI();
    document.body.style.removeProperty('opacity');


    function setupEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => connectWallet(false));
        document.getElementById('disconnectBtn').addEventListener('click', () => disconnectWallet(false));
        document.getElementById('issueCertificateBtn').addEventListener('click', issueCertificate);
        document.getElementById('requestCertificateBtn').addEventListener('click', requestCertificate);
        document.getElementById('verifyCertificateBtn').addEventListener('click', verifyCertificate);

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }
    }

    async function checkWalletConnection() {
        if (typeof window.ethereum === 'undefined') {
            if (window.showToast) window.showToast('Please install MetaMask to use this application', 'warning');
            return;
        }

        const userWantsConnection = localStorage.getItem('walletConnected') === 'true';

        if (userWantsConnection) {
            try {
                // revisar las cuentas existentes sin sacar el popup de metamask
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });

                if (accounts.length > 0) {
                    await connectWallet(true, accounts);
                } else {
                    localStorage.setItem('walletConnected', 'false');
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
                localStorage.setItem('walletConnected', 'false');
            }
        }
    }

    async function connectWallet(isReload = false, preloadedAccounts = null) {
        if (typeof window.ethereum === 'undefined') {
            if (window.showToast) window.showToast('MetaMask is not installed', 'error');
            return;
        }

        try {
            let accounts;

            // usar la cuenta pre-cargada al recargar pero la cuenta solicitada si te conectas
            // de forma manual

            if (preloadedAccounts && preloadedAccounts.length > 0) {
                accounts = preloadedAccounts;
            } else {
                accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            }

            if (!accounts || accounts.length === 0) {
                return;
            }

            // cambiar a o agregar la red de Hardhat
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: CONFIG.chainId }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: CONFIG.chainId,
                            chainName: CONFIG.chainName,
                            rpcUrls: [CONFIG.rpcUrl],
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
                        }],
                    });
                } else { throw switchError; }
            }

            // inicializa las instancias de ether
            state.provider = new ethers.BrowserProvider(window.ethereum);
            state.signer = await state.provider.getSigner();
            state.account = accounts[0];
            state.contract = new ethers.Contract(CONFIG.contractAddress, CONTRACT_ABI, state.signer);
            state.isConnected = true; 

            localStorage.setItem('walletConnected', 'true');

            await checkAdminStatus();
            await loadDashboardData(); 

            // esto hace que cuando hagas un F5 no vueva a salir esto de la wallet se conectó
            if (!isReload) {
                if (window.showToast) window.showToast('Wallet connected successfully', 'success');
                updateUI();
            }

        } catch (error) {
            console.error('Error connecting wallet:', error);
            if (window.showToast) window.showToast('Failed to connect wallet: ' + (error.reason || error.message), 'error');
            disconnectWallet(true);
        }
    }

    function disconnectWallet(isSilent = false) {
        state = {
            provider: null,
            signer: null,
            contract: null,
            account: null,
            isAdmin: false,
            isConnected: false
        };
        localStorage.setItem('walletConnected', 'false');

        if (!isSilent) {
            updateUI();
            if (window.showToast) window.showToast('Wallet disconnected', 'info');
        }
    }

    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            disconnectWallet();
        } else if (accounts[0] !== state.account) {
            window.location.reload();
        }
    }

    async function checkAdminStatus() {
        if (!state.isConnected) return; 
        try {
            state.isAdmin = await state.contract.admins(state.account);
        } catch (error) {
            console.error('Error checking admin status:', error);
            state.isAdmin = false;
        }
    }

    async function issueCertificate() {
        if (!state.isConnected) {
            if (window.showToast) window.showToast('Please connect your wallet first', 'warning');
            return;
        }

        const studentAddress = document.getElementById('studentAddress').value;
        const certificateHash = document.getElementById('issueCertificateHash').value;
        const institution = document.getElementById('institution').value;

        if (!studentAddress || !certificateHash || !institution) {
            if (window.showToast) window.showToast('Please complete all fields', 'warning');
            return;
        }

        if (!ethers.isAddress(studentAddress)) {
            if (window.showToast) window.showToast('Invalid student address', 'error');
            return;
        }

        try {
            if (window.showToast) window.showToast('Processing transaction...', 'info');

            const issueFee = await state.contract.issueFee();
            const tx = await state.contract.issueCertificate(
                studentAddress,
                certificateHash,
                institution,
                { value: issueFee }
            );

            if (window.showToast) window.showToast('Waiting for confirmation...', 'info');
            await tx.wait();

            if (window.showToast) window.showToast('Certificate issued successfully', 'success');
            document.getElementById('issueForm').reset();

            await loadDashboardData();
            updateUI();

        } catch (error) {
            console.error('Error issuing certificate:', error);
            if (error.message.includes('Only admin')) {
                if (window.showToast) window.showToast('Only administrators can issue certificates', 'error');
            } else {
                if (window.showToast) window.showToast('Failed to issue certificate: ' + (error.reason || error.message), 'error');
            }
        }
    }

    async function requestCertificate() {
        if (!state.isConnected) {
            if (window.showToast) window.showToast('Please connect your wallet first', 'warning');
            return;
        }

        const certificateHash = document.getElementById('requestCertificateHash').value;

        if (!certificateHash) {
            if (window.showToast) window.showToast('Please enter the certificate hash', 'warning');
            return;
        }

        try {
            if (window.showToast) window.showToast('Processing request...', 'info');

            const requestFee = await state.contract.requestFee();
            const tx = await state.contract.requestCertificate(certificateHash, {
                value: requestFee
            });

            if (window.showToast) window.showToast('Waiting for confirmation...', 'info');
            await tx.wait();

            if (window.showToast) window.showToast('Certificate request submitted successfully', 'success');
            document.getElementById('requestCertificateHash').value = '';

        } catch (error) {
            console.error('Error requesting certificate:', error);
            if (window.showToast) window.showToast('Failed to request certificate: ' + (error.reason || error.message), 'error');
        }
    }

    async function verifyCertificate() {
        const certificateHash = document.getElementById('verifyCertificateHash').value;

        if (!certificateHash) {
            if (window.showToast) window.showToast('Please enter the certificate hash', 'warning');
            return;
        }

        let contractInstance = state.contract;
        if (!contractInstance) {
            try {
                const readOnlyProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
                contractInstance = new ethers.Contract(CONFIG.contractAddress, CONTRACT_ABI, readOnlyProvider);
            } catch (e) {
                if (window.showToast) window.showToast('Failed to connect to blockchain', 'error');
                return;
            }
        }

        const resultDiv = document.getElementById('verifyResult');
        resultDiv.innerHTML = '';

        try {
            let [exists, student, institution, timestamp] = await contractInstance.verifyCertificate(certificateHash);

            if (exists) {
                const date = new Date(Number(timestamp) * 1000).toLocaleDateString();

                resultDiv.innerHTML = `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/50 dark:border-green-700">
                        <h4 class="font-bold text-green-800 mb-2 dark:text-green-200">Valid Certificate</h4>
                        <p class="text-gray-700 dark:text-gray-300"><strong>Student:</strong> ${student}</p>
                        <p class="text-gray-700 dark:text-gray-300"><strong>Institution:</strong> ${institution}</p>
                        <p class="text-gray-700 dark:text-gray-300"><strong>Date:</strong> ${date}</p>
                    </div>
                `;

                if (window.showToast) window.showToast('Certificate verified successfully', 'success');
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/50 dark:border-red-700">
                        <h4 class="font-bold text-red-800 mb-2 dark:text-red-200">Certificate Not Found</h4>
                        <p class="text-gray-700 dark:text-gray-300">This certificate does not exist on the blockchain</p>
                    </div>
                `;

                if (window.showToast) window.showToast('Certificate not found', 'error');
            }

        } catch (error) {
            console.error('Error verifying certificate:', error);
            if (window.showToast) window.showToast('Failed to verify certificate: ' + (error.reason || error.message), 'error');

            resultDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/50 dark:border-red-700">
                    <h4 class="font-bold text-red-800 mb-2 dark:text-red-200">Verification Error</h4>
                    <p class="text-gray-700 dark:text-gray-300">${error.reason || error.message}</p>
                </div>
            `;
        }
    }

    async function loadDashboardData() {
        if (!state.isConnected || !state.contract) return;

        try {
            const count = await state.contract.certificateCount();
            const issueFee = await state.contract.issueFee();
            const requestFee = await state.contract.requestFee();

            document.getElementById('totalCertificates').textContent = count.toString();
            document.getElementById('issueFeeAmount').textContent = ethers.formatEther(issueFee);
            document.getElementById('requestFeeAmount').textContent = ethers.formatEther(requestFee);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            document.getElementById('totalCertificates').textContent = 'Error';
            document.getElementById('issueFeeAmount').textContent = 'Error';
            document.getElementById('requestFeeAmount').textContent = 'Error';
        }
    }

    function updateUI() {
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const adminBadge = document.getElementById('adminBadge');
        const connectedSection = document.getElementById('connectedSection');
        const readOnlySection = document.getElementById('readOnlySection');
        const issueSection = document.getElementById('issueSection');

        if (state.isConnected) {
            connectBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
            walletInfo.classList.remove('hidden');
            connectedSection.classList.remove('hidden');
            readOnlySection.classList.add('hidden');

            walletAddress.textContent = `${state.account.substring(0, 6)}...${state.account.substring(38)}`;

            if (state.isAdmin) {
                adminBadge.classList.remove('hidden');
                issueSection.classList.remove('hidden');
            } else {
                adminBadge.classList.add('hidden');
                issueSection.classList.add('hidden');
            }
        } else {
            connectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('hidden');
            walletInfo.classList.add('hidden');
            connectedSection.classList.add('hidden');
            readOnlySection.classList.remove('hidden'); 
            issueSection.classList.add('hidden');
        }
    }

    function formatAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(38)}`;
    }

    function formatDate(timestamp) {
        return new Date(timestamp * 1000).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

};
