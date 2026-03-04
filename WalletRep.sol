// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
// WalletRep.sol
// Soulbound Token (ERC-5192) that stores a wallet's WalletRep score on Base.
//
// Key behaviors:
//  - Only the backend signer can authorize a mint/update (ECDSA signature)
//  - Each wallet can hold exactly ONE token at a time
//  - Updating burns the old token and mints a new one (score refresh)
//  - Tokens are non-transferable (soulbound, ERC-5192)
//  - Anyone can donate ETH via donate()
//  - Owner can withdraw donations to a fixed recipient wallet
// ─────────────────────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract WalletRep is ERC721, Ownable {
    using ECDSA for bytes32;
    using Strings for uint256;

    // ─── ERC-5192 Soulbound Interface ────────────────────────────────────────
    // ERC-5192 is the standard for minimal soulbound tokens.
    // It adds a `locked()` function and a `Locked` event to ERC-721.
    bytes4 private constant _INTERFACE_ID_ERC5192 = 0xb45a3c0e;

    event Locked(uint256 tokenId);   // fired when a token becomes soulbound
    event Unlocked(uint256 tokenId); // required by spec, never actually used here

    // ─── Score Data ──────────────────────────────────────────────────────────

    // Tier names matching the 5-tier system
    // 1=Newbie, 2=Explorer, 3=Degen-in-Training, 4=Veteran, 5=DEGEN
    struct ScoreData {
        uint8  score;       // 1-100 numeric score
        uint8  tier;        // 1-5 tier
        string tierName;    // human-readable tier name
        uint256 mintedAt;   // unix timestamp of mint
        uint256 updatedAt;  // unix timestamp of last update
    }

    // tokenId => score data
    mapping(uint256 => ScoreData) public scoreData;

    // wallet address => tokenId (0 means no token)
    mapping(address => uint256) public walletToken;

    // ─── Signing ─────────────────────────────────────────────────────────────
    // The backend signer's address. Only signatures from this key are accepted.
    // This prevents anyone from minting a fake score.
    address public backendSigner;

    // Nonces prevent replay attacks (same signature used twice)
    mapping(address => uint256) public nonces;

    // ─── Donations ───────────────────────────────────────────────────────────
    // The fixed wallet that receives all donations. Set once at deploy.
    address payable public donationRecipient;

    event Donated(address indexed donor, uint256 amount);
    event DonationWithdrawn(address indexed recipient, uint256 amount);

    // ─── Token ID Counter ────────────────────────────────────────────────────
    uint256 private _nextTokenId = 1;

    // ─── Base URI for metadata ───────────────────────────────────────────────
    string private _baseTokenURI;

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // @param _backendSigner  Address of your backend signing key
    // @param _donationWallet Fixed wallet that receives donations
    // @param baseURI_        IPFS or API URL for token metadata
    // ─────────────────────────────────────────────────────────────────────────
    constructor(
        address _backendSigner,
        address payable _donationWallet,
        string memory baseURI_
    ) ERC721("WalletRep", "WREP") Ownable(msg.sender) {
        require(_backendSigner != address(0), "Invalid signer");
        require(_donationWallet != address(0), "Invalid donation wallet");

        backendSigner    = _backendSigner;
        donationRecipient = _donationWallet;
        _baseTokenURI    = baseURI_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MINT / UPDATE SCORE
    //
    // Called by the user's wallet after the backend has computed and signed
    // their score. The contract verifies the signature before minting.
    //
    // @param score      1-100 numeric score
    // @param tier       1-5 tier number
    // @param tierName   e.g. "DEGEN"
    // @param signature  ECDSA signature from backendSigner
    // ─────────────────────────────────────────────────────────────────────────
    function mintOrUpdateScore(
        uint8 score,
        uint8 tier,
        string calldata tierName,
        bytes calldata signature
    ) external {
        require(score >= 1 && score <= 100, "Score out of range");
        require(tier  >= 1 && tier  <= 5,   "Tier out of range");

        // ── Verify the backend signature ──────────────────────────────────
        // The backend signs: keccak256(wallet, score, tier, nonce, chainId)
        // This ensures:
        //   - The score was computed by YOUR backend (not faked)
        //   - The signature can only be used once (nonce)
        //   - The signature can only be used on Base (chainId)
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                score,
                tier,
                nonces[msg.sender],
                block.chainid
            )
        );

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ethSignedHash.recover(signature);
        require(recovered == backendSigner, "Invalid signature");

        // Increment nonce so this signature can't be reused
        nonces[msg.sender]++;

        // ── Burn existing token if wallet already has one ─────────────────
        uint256 existingTokenId = walletToken[msg.sender];
        if (existingTokenId != 0) {
            _burn(existingTokenId);
            delete scoreData[existingTokenId];
        }

        // ── Mint new token ────────────────────────────────────────────────
        uint256 newTokenId = _nextTokenId++;
        _safeMint(msg.sender, newTokenId);

        // Store score data on-chain
        scoreData[newTokenId] = ScoreData({
            score:     score,
            tier:      tier,
            tierName:  tierName,
            mintedAt:  existingTokenId == 0 ? block.timestamp : scoreData[existingTokenId].mintedAt,
            updatedAt: block.timestamp
        });

        walletToken[msg.sender] = newTokenId;

        // Emit ERC-5192 Locked event — token is now soulbound
        emit Locked(newTokenId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BURN (user can delete their own token / "opt out")
    // ─────────────────────────────────────────────────────────────────────────
    function burnMyToken() external {
        uint256 tokenId = walletToken[msg.sender];
        require(tokenId != 0, "No token to burn");

        _burn(tokenId);
        delete scoreData[tokenId];
        delete walletToken[msg.sender];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SOULBOUND — block all transfers except mint (from=0) and burn (to=0)
    // This enforces the soulbound property: tokens cannot be traded or sold.
    // ─────────────────────────────────────────────────────────────────────────
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow mint (from == address(0)) and burn (to == address(0))
        // Block everything else (transfers)
        if (from != address(0) && to != address(0)) {
            revert("WalletRep: soulbound, non-transferable");
        }

        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DONATIONS
    // Anyone can send ETH directly or call donate()
    // ─────────────────────────────────────────────────────────────────────────
    function donate() external payable {
        require(msg.value > 0, "Donation must be > 0");
        emit Donated(msg.sender, msg.value);
    }

    // Fallback: accept plain ETH transfers
    receive() external payable {
        emit Donated(msg.sender, msg.value);
    }

    // Owner withdraws accumulated donations to the fixed recipient wallet
    function withdrawDonations() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");

        (bool success, ) = donationRecipient.call{value: balance}("");
        require(success, "Withdrawal failed");

        emit DonationWithdrawn(donationRecipient, balance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    // Get the full score data for a wallet address
    function getScoreByWallet(address wallet)
        external
        view
        returns (ScoreData memory)
    {
        uint256 tokenId = walletToken[wallet];
        require(tokenId != 0, "Wallet has no WalletRep token");
        return scoreData[tokenId];
    }

    // Check if a token is locked/soulbound (ERC-5192)
    function locked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return true; // all WalletRep tokens are always locked
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    // Rotate the backend signer key (e.g. if compromised)
    function setBackendSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer");
        backendSigner = newSigner;
    }

    // Update metadata base URI
    function setBaseURI(string calldata newURI) external onlyOwner {
        _baseTokenURI = newURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ERC-165 interface support (includes ERC-5192)
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return
            interfaceId == _INTERFACE_ID_ERC5192 ||
            super.supportsInterface(interfaceId);
    }
}
