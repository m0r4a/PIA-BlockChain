const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...\n");

  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "wei\n");

  // deploy contract
  console.log("Deploying CertiChain contract...");
  const CertiChain = await hre.ethers.getContractFactory("CertiChain");
  const certiChain = await CertiChain.deploy();
  await certiChain.waitForDeployment();

  console.log("CertiChain deployed to:", certiChain.address);
  console.log("Owner/Admin:", deployer.address);

  const issueFee = await certiChain.issueFee();
  const requestFee = await certiChain.requestFee();
  const certificateCount = await certiChain.certificateCount();

  console.log("\nContract Information:");
  console.log("  Issue Fee:", hre.ethers.formatEther(issueFee), "ETH");
  console.log("  Request Fee:", hre.ethers.formatEther(requestFee), "ETH");
  console.log("  Certificate Count:", certificateCount.toString());

  // guardar info del deployment
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: certiChain.address,
    owner: deployer.address,
    issueFee: hre.ethers.formatEther(issueFee),
    requestFee: hre.ethers.formatEther(requestFee),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\nDeployment info saved to:", deploymentFile);

  // guardar el ABI
  const artifactPath = path.join(__dirname, "artifacts", "contracts", "contract.sol", "CertiChain.json");

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiFile = path.join(deploymentsDir, "CertiChain.abi.json");
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log("ABI saved to:", abiFile);
  } else {
    // ruta alternativa
    const originalArtifactPath = path.join(__dirname, "artifacts", "contract.sol", "CertiChain.json");
    if (fs.existsSync(originalArtifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(originalArtifactPath, "utf8"));
      const abiFile = path.join(deploymentsDir, "CertiChain.abi.json");
      fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
      console.log("ABI saved to:", abiFile);
    } else {
      console.warn("Warning: Could not find artifact file to save ABI");
    }
  }

  // operaciones de prueba en localhost
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("\nRunning test operations...");

    const testHash = "test-cert-" + Date.now();
    const testInstitution = "Universidad Ejemplo";

    console.log("\n  Issuing test certificate...");
    const tx = await certiChain.issueCertificate(
      deployer.address,
      testHash,
      testInstitution,
      { value: issueFee }
    );
    await tx.wait();

    console.log("  Test certificate issued");
    console.log("  Hash:", testHash);

    const [exists, student, institution, timestamp] = await certiChain.verifyCertificate(testHash);
    console.log("\n  Certificate Verification:");
    console.log("  Exists:", exists);
    console.log("  Student:", student);
    console.log("  Institution:", institution);
    console.log("  Timestamp:", new Date(Number(BigInt(timestamp)) * 1000).toLocaleString());

    const totalCerts = await certiChain.certificateCount();
    console.log("\n  Total certificates:", totalCerts.toString());
  }

  console.log("\nFrontend Configuration:");
  console.log("  Contract Address:", certiChain.address);
  console.log("  Network:", hre.network.name);
  console.log("  Chain ID:", hre.network.config.chainId);

  // verificar en etherscan solo para redes públicas
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");

    const deployTx = certiChain.deploymentTransaction();
    if (deployTx) {
      await deployTx.wait(6);
    } else {
      console.warn("Warning: Could not get deployment transaction");
    }

    console.log("\nVerifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: certiChain.address,
        constructorArguments: []
      });
      console.log("Contract verified on Etherscan");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\nDeployment completed successfully\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:");
    console.error(error);
    process.exit(1);
  });
