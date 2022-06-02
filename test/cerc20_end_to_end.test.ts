const {waffle, ethers} = require("hardhat");
import { ContractFactory, BigNumber} from "ethers";
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
// var RollupNC = artifacts.require("RollupNC");
// var TokenRegistry = artifacts.require("TokenRegistry")
// var TestToken = artifacts.require("TestToken")

/*
    Here we want to test the smart contract's deposit functionality.
*/

describe("CERC20RollupNC", () => {
    let accounts;
    let rollupNC;
    let tokenRegistry;
    let testToken;
    let mimc;
    let miMCMerkle;

    before(async function () {
        accounts = await hre.ethers.getSigners()

        const SEED = "mimc";
        let abi = cls.mimc7Contract.abi
        let createCode = cls.mimc7Contract.createCode
        let factory = new ContractFactory(
            abi, createCode(SEED, 91), accounts[0]
        )
        mimc = await factory.deploy()

        factory = await ethers.getContractFactory("MiMCMerkle");
        miMCMerkle = await factory.connect(accounts[0]).deploy(mimc.address)
        await miMCMerkle.deployed()

        factory = await ethers.getContractFactory("TokenRegistry");
        tokenRegistry = await factory.deploy(accounts[0].address)
        await tokenRegistry.deployed()

        factory = await ethers.getContractFactory("CERC20RollupNC");
        rollupNC = await factory.connect(accounts[0]).deploy(mimc.address, miMCMerkle.address, tokenRegistry.address)
        await rollupNC.deployed()

        factory = await ethers.getContractFactory("TestToken");
        testToken = await factory.connect(accounts[3]).deploy()
        await testToken.deployed()
    });

    // ----------------------------------------------------------------------------------

    it("should set rollupNC address", async () => {
        let setRollupNC = await tokenRegistry.connect(accounts[0]).setRollupNC(rollupNC.address, { from: accounts[0].address });
        assert(setRollupNC, 'setRollupNC failed')
    });

    // ----------------------------------------------------------------------------------


    // const tokenContractAddr = "0xaD6D458402F60fD3Bd25163575031ACDce07538D"

    it("should register token", async () => {
        let registerToken = await rollupNC.connect(accounts[1]).registerToken(testToken.address, { from: accounts[1].address })
        assert(registerToken, "token registration failed");
    });

    // ----------------------------------------------------------------------------------

    it("should approve token", async () => {
        let approveToken = await rollupNC.connect(accounts[0]).approveToken(testToken.address, { from: accounts[0].address })
        assert(approveToken, "token registration failed");
	});
	
    // ----------------------------------------------------------------------------------
    it("should approve RollupNC on TestToken", async () => {
        let approveToken = await testToken.connect(accounts[3]).approve(
            rollupNC.address, 1700,
            {from: accounts[3].address}
        )
        assert(approveToken, "approveToken failed")
    });

    // ----------------------------------------------------------------------------------

    const pubkeyCoordinator = [
        '1891156797631087029347893674931101305929404954783323547727418062433377377293',
        '14780632341277755899330141855966417738975199657954509255716508264496764475094'
    ]
    const pubkeyA = [
        '16854128582118251237945641311188171779416930415987436835484678881513179891664',
        '8120635095982066718009530894702312232514551832114947239433677844673807664026'
    ]
    const pubkeyB = [
        '17184842423611758403179882610130949267222244268337186431253958700190046948852',
        '14002865450927633564331372044902774664732662568242033105218094241542484073498'
    ]
    // balance = [1000, 20, 200, 100, 500, 20] 
    // the followting commitment are pedersen commitment to the balance
    // see the log of generate_update_state_verifier.js
    const balanceCommA = [
        '5215105629706376708922878512632466223806033711666926955695294143162007327123',
        '16567402936052379644958396574386279074272063527227982023835273985814042297529'
    ]

    const balanceCommB = [
        '1865330133187128029206928252820498246222779100788023450241938871486215630222',
        '6174494639574274793003315896449994651807395242345196006683980020239003133398'
    ]

    const balanceCommC = [
        '1810383034909362125784730897165563287099872033575479550055496709691766462827',
        '8142529248032188225183026471517148911240509999741611606264723552670300863038'
    ]

    const balanceCommD = [
        '15418067460412916094061055567245842040105654178817609238474285712116939609623',
        '11870480574984646311399909734846160851219855411400932040214559410667322786034'
    ]

    const balanceCommE = [
        '3720608061666222463308653064246011655718073266305072596737303987109273717585',
        '20910974885934693226688636290732633161999480197244674029192729660775776833003'
    ]

    const balanceCommF = [
        '16186236698373799410917322445784978186833714999331376970515835987754585796425',
        '20470655806294812289805945250878350722667605757256666513086532052615320355005'
    ]

    it("should make first batch of deposits", async () => {
        // zero leaf
        let deposit0 = await rollupNC.connect(accounts[0]).deposit([0, 0], 0, 0, 0, 0, { from: accounts[0].address })
        assert(deposit0, "deposit0 failed");

        // operator account
        let deposit1 = await rollupNC.connect(accounts[0]).deposit(pubkeyCoordinator, 0, 0, 0, 0, { from: accounts[0].address })
        assert(deposit1, "deposit1 failed");

        // Alice account
        let deposit2 = await rollupNC.connect(accounts[3]).deposit(pubkeyA, 1000, balanceCommA[0], balanceCommA[1], 2, { from: accounts[3].address })
        assert(deposit2, "deposit2 failed");

        // Bob account
        let deposit3 = await rollupNC.connect(accounts[2]).deposit(pubkeyB, 20, balanceCommB[0], balanceCommB[1], 1, { value: 20, from: accounts[2].address })
        assert(deposit3, "deposit3 failed");

        await rollupNC.currentRoot().then(console.log)

	});

    // ----------------------------------------------------------------------------------

    // first4Hash is the pendingDeposits[0] after the first four time deposits. See the log in processDeposits of RollupNC.sol
    const first4Hash = '14721064885583928011024709563508870737724445503891441892572143793523988368989';
    const first4HashPosition = [0, 0]
    // find first4HashProof in zeroCache
    const first4HashProof = [
        '19642209756261147487299395139138750018042610884404237622752434560230554958919',
        '16580474105437433399820305371359442442925783187705352117189664556047228178620'
    ]

    it("should process first batch of deposits", async () => {
        let processDeposit1
        try {
            processDeposit1 = await rollupNC.connect(accounts[0]).processDeposits(
                2,
                first4HashPosition,
                first4HashProof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await rollupNC.currentRoot().then(console.log)
    })

    // ----------------------------------------------------------------------------------

    const pubkeyC = [
        '1490516688743074134051356933225925590384196958316705484247698997141718773914',
        '18202685495984068498143988518836859608946904107634495463490807754016543014696'
    ]
    const pubkeyD = [
        '605092525880098299702143583094084591591734458242948998084437633961875265263',
        '5467851481103094839636181114653589464420161012539785001778836081994475360535'
    ]
    const pubkeyE = [
        '6115308589625576351618964952901291926887010055096213039283160928208018634120',
        '7748831575696937538520365609095562313470874985327756362863958469935920020098'
    ]
    const pubkeyF = [
        '8497552053649025231196693001489376949137425670153512736866407813496427593491',
        '2919902478295208415664305012229488283720319044050523257046455410971412405951'
    ]

    it("should make second batch of deposits", async () => {
        let deposit4 = await rollupNC.connect(accounts[3]).deposit(pubkeyC, 200, balanceCommC[0], balanceCommC[1], 2, { from: accounts[3].address })
        assert(deposit4, "deposit4 failed");

        let deposit5 = await rollupNC.connect(accounts[4]).deposit(pubkeyD, 100, balanceCommD[0], balanceCommD[1], 1, { value: 100, from: accounts[4].address })
        assert(deposit5, "deposit5 failed");

        let deposit6 = await rollupNC.connect(accounts[3]).deposit(pubkeyE, 500, balanceCommE[0], balanceCommE[1], 2, { from: accounts[3].address })
        assert(deposit6, "deposit6 failed");

        let deposit7 = await rollupNC.connect(accounts[6]).deposit(pubkeyF, 20, balanceCommF[0], balanceCommF[1], 1, { value: 20, from: accounts[6].address })
        assert(deposit7, "deposit7 failed");
        await rollupNC.currentRoot().then(console.log)

    });


    // ----------------------------------------------------------------------------------

    let second4HashPosition = [1, 0]
    let second4HashProof = [
        first4Hash,
        '16580474105437433399820305371359442442925783187705352117189664556047228178620'
    ]

    it("should process second batch of deposits", async () => {
        let processDeposit2 = await rollupNC.connect(accounts[0]).processDeposits(
            2,
            second4HashPosition,
            second4HashProof,
            { from: accounts[0].address }
        )
        assert(processDeposit2, "processDeposit2 failed")
        await rollupNC.currentRoot().then(console.log)
    })

    // ----------------------------------------------------------------------------------
    const updateProof = require("../circuits/cerc20_update_state_verifier_js/proof.json")
    const updateInput = require("../circuits/cerc20_update_state_verifier_js/public.json")

    it("should accept valid state updates", async () => {
        let validStateUpdate = await rollupNC.updateState(
            updateProof, updateInput
        );
        assert(validStateUpdate, "invalid state transition");
        await rollupNC.currentRoot().then(console.log)

    });

    // ----------------------------------------------------------------------------------
    const pubkey_from = [
        "1490516688743074134051356933225925590384196958316705484247698997141718773914",
        "18202685495984068498143988518836859608946904107634495463490807754016543014696"
    ]
    const index = 4;
    const nonce = 0;
    const amount = 200;
    const amountCommX = '9341183806046945975899794600644556318856212299778937256033928972578582119309';
    const amountCommY =  '17915237297382614290694052048803643555455091130530898329619979119852738104259';
    const token_type_from = 2;
    const position = [1, 0]
    // txRoot in input.json
    const txRoot = "18835546343272708796504637647870507671383537498155645919921294787859131196665"
    const recipient = "0xC33Bdb8051D6d2002c0D80A1Dd23A1c9d9FC26E4"

    let withdraw_proof = require("../circuits/withdraw_signature_verifier_js/proof.json")

    // you can get this proof from input.json generated by generate_update_state_verifier.js
    // just remember the proof corresponds to position above
    const proof = [
        "410255835942095132970547052518360670137748072550713764369963378005296489294",
        "1497808344369112330930159795119053617968639878945060375430051974506530259712"
    ]

    it("should accept valid withdrawals", async () => {
        const txInfo = {
            pubkeyX: pubkey_from[0],
            pubkeyY: pubkey_from[1],
            index: index,
            toX: BigNumber.from(0),
            toY: BigNumber.from(0),
            nonce: BigNumber.from(nonce),
            amountCommX: BigNumber.from(amountCommX),
            amountCommY: BigNumber.from(amountCommY),
            token_type_from: BigNumber.from(token_type_from),
            txRoot: txRoot,
            position: position,
            proof: proof,
        }
        let validWithdraw = await rollupNC.connect(accounts[3]).withdraw(
            txInfo, recipient,
            withdraw_proof, amount, 
            {from: accounts[3].address}
        );
        assert(validWithdraw, "invalid withdraw");
    });
});