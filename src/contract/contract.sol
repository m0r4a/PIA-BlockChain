pragma solidity ^0.8.19;

contract CertiChain {

    struct Certificate {
        address student;
        string certificateHash;
        string institution;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => Certificate) public certificates;
    mapping(address => bool) public admins;

    address public owner;
    uint256 public certificateCount;

    uint256 public issueFee = 0.01 ether;
    uint256 public requestFee = 0.005 ether;

    event CertificateIssued(
        address indexed student,
        string certificateHash,
        string institution,
        uint256 timestamp
    );

    event CertificateRequested(
        address indexed requester,
        string certificateHash,
        uint256 timestamp
    );

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event FeesUpdated(uint256 issueFee, uint256 requestFee);
    event FundsWithdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    // emitir un certificado nuevo (solo admins)
    function issueCertificate(
        address _student,
        string memory _certificateHash,
        string memory _institution
    ) public payable onlyAdmin {
        require(msg.value >= issueFee, "Insufficient fee for issuing certificate");
        require(_student != address(0), "Invalid student address");
        require(bytes(_certificateHash).length > 0, "Certificate hash cannot be empty");
        require(bytes(_institution).length > 0, "Institution name cannot be empty");
        require(!certificates[_certificateHash].exists, "Certificate already exists");

        certificates[_certificateHash] = Certificate({
            student: _student,
            certificateHash: _certificateHash,
            institution: _institution,
            timestamp: block.timestamp,
            exists: true
        });

        certificateCount++;

        emit CertificateIssued(_student, _certificateHash, _institution, block.timestamp);
    }

    // solicitar un certificado
    // cualquier usuario puede pagar
    // la idea es implementar funcionalidad para un usuario normal y para admin
    function requestCertificate(string memory _certificateHash) public payable {
        require(msg.value >= requestFee, "Insufficient fee for requesting certificate");
        require(bytes(_certificateHash).length > 0, "Certificate hash cannot be empty");

        emit CertificateRequested(msg.sender, _certificateHash, block.timestamp);
    }

    // verificar si existe un certificado y obtener sus datos
    function verifyCertificate(string memory _certificateHash) 
        public
        view
        returns (
            bool exists,
            address student,
            string memory institution,
            uint256 timestamp
        )
    {
        Certificate memory cert = certificates[_certificateHash];
        return (
            cert.exists,
            cert.student,
            cert.institution,
            cert.timestamp
        );
    }

    function addAdmin(address _admin) public onlyOwner {
        require(_admin != address(0), "Invalid admin address");
        require(!admins[_admin], "Address is already an admin");

        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) public onlyOwner {
        require(_admin != address(0), "Invalid admin address");
        require(admins[_admin], "Address is not an admin");
        require(_admin != owner, "Cannot remove owner as admin");

        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    function updateFees(uint256 _issueFee, uint256 _requestFee) public onlyOwner {
        issueFee = _issueFee;
        requestFee = _requestFee;
        emit FeesUpdated(_issueFee, _requestFee);
    }

    function withdrawFunds() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(owner, balance);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function isAdmin(address _address) public view returns (bool) {
        return admins[_address];
    }

    receive() external payable {}

    fallback() external payable {}
}
