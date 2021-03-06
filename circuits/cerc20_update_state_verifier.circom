pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimc.circom";
include "../node_modules/circomlib/circuits/eddsamimc.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

include "./helpers/get_merkle_root.circom";
include "./helpers/if_gadgets.circom";
include "./helpers/cerc20_tx_existence_check.circom";
include "./helpers/cerc20_balance_existence_check.circom";
include "./helpers/cerc20_balance_leaf.circom";
include "./helpers/cerc20.circom";


template Main(n, m) {
    // n is depth of balance tree
    // m is depth of transactions tree
    // for each proof, update 2**m transactions

    // Merkle root of transactions tree
    signal input txRoot;

    // Merkle proof for transaction in tx tree
    signal input paths2txRoot[2**m][m];

    // binary vector indicating whether node in tx proof is left or right
    signal input paths2txRootPos[2**m][m];

    // Merkle root of old balance tree
    signal input currentState;

    // intermediate roots (two for each tx), final element is last.
    signal input intermediateRoots[2**(m+1)+1];

    // Merkle proof for sender account in balance tree
    signal input paths2rootFrom[2**m][n];

    // binary vector indicating whether node in balance proof for sender account
    // is left or right 
    signal input paths2rootFromPos[2**m][n];

    // Merkle proof for receiver account in balance tree
    signal input paths2rootTo[2**m][n];

    // binary vector indicating whether node in balance proof for receiver account
    // is left or right 
    signal input paths2rootToPos[2**m][n];

    // tx info, 10 fields
    signal input fromX[2**m]; //sender address x coordinate
    signal input fromY[2**m]; //sender address y coordinate
    signal input fromIndex[2**m]; //sender account leaf index
    signal input toX[2**m]; // receiver address x coordinate
    signal input toY[2**m]; // receiver address y coordinate
    signal input nonceFrom[2**m]; // sender account nonce
    signal input amountCommX[2**m]; // amount Commitment X
    signal input amountCommY[2**m]; // amount Commitment Y
    signal input tokenTypeFrom[2**m]; // sender token type
    signal input R8x[2**m]; // sender signature
    signal input R8y[2**m]; // sender signature
    signal input S[2**m]; // sender signature

    // additional account info (not included in tx)
    signal input balanceCommXFrom[2**m]; // sender token balance commitment X
    signal input balanceCommYFrom[2**m]; // sender token balance commitment Y
    signal input balanceCommXTo[2**m]; // receiver token balance commitment X
    signal input balanceCommYTo[2**m]; // receiver token balance commitment Y
    signal input nonceTo[2**m]; // receiver account nonce
    signal input tokenTypeTo[2**m]; // receiver token type

    // // new balance tree Merkle root
    signal output out;

    var NONCE_MAX_VALUE = 100;

    // constant zero address

    var ZERO_ADDRESS_X = 0;
    var ZERO_ADDRESS_Y = 0;

    component txExistence[2**m];
    component senderExistence[2**m];
    component ifBothHighForceEqual[2**m];
    component newSender[2**m];
    component computedRootFromNewSender[2**m];
    component receiverExistence[2**m];
    component newReceiver[2**m];
    component allLow[2**m];
    component ifThenElse1[2**m];
    component ifThenElse2[2**m];
    component computedRootFromNewReceiver[2**m];
    // component greater[2**m];
    // component greaterSender[2**m];
    // component greaterReceiver[2**m];
    component nonceEquals[2**m];
    component subBalanceComm[2**m];
    component addBalanceComm[2**m];

    component CERC20TokenFrom[2**m];
    component CERC20TokenTo[2**m];

    currentState === intermediateRoots[0];

    for (var i = 0; i < 2**m; i++) {
        // transactions existence and signature check
        txExistence[i] = TxExistence(m);
        txExistence[i].fromX <== fromX[i];
        txExistence[i].fromY <== fromY[i];
        txExistence[i].fromIndex <== fromIndex[i];
        txExistence[i].toX <== toX[i];
        txExistence[i].toY <== toY[i];
        txExistence[i].nonce <== nonceFrom[i];
        txExistence[i].amountComm[0] <== amountCommX[i];
        txExistence[i].amountComm[1] <== amountCommY[i];
        txExistence[i].tokenType <== tokenTypeFrom[i];

        txExistence[i].txRoot <== txRoot;

        for (var j = 0; j < m; j++){
            txExistence[i].paths2rootPos[j] <== paths2txRootPos[i][j];
            txExistence[i].paths2root[j] <== paths2txRoot[i][j];
        }

        txExistence[i].R8x <== R8x[i];
        txExistence[i].R8y <== R8y[i];
        txExistence[i].S <== S[i];

        // CERC20Token sender
        CERC20TokenFrom[i] = CERC20TokenFrom();
        CERC20TokenFrom[i].currentBalance[0] <== balanceCommXFrom[i];
        CERC20TokenFrom[i].currentBalance[1] <== balanceCommYFrom[i];
        CERC20TokenFrom[i].amount[0] <== amountCommX[i];
        CERC20TokenFrom[i].amount[1] <== amountCommY[i];

        // sender existence check
        senderExistence[i] = BalanceExistence(n);
        senderExistence[i].x <== fromX[i];
        senderExistence[i].y <== fromY[i];
        senderExistence[i].balanceComm[0] <== balanceCommXFrom[i];
        senderExistence[i].balanceComm[1] <== balanceCommYFrom[i];
        senderExistence[i].nonce <== nonceFrom[i];
        senderExistence[i].tokenType <== tokenTypeFrom[i];

        senderExistence[i].balanceRoot <== intermediateRoots[2*i];
        for (var j = 0; j < n; j++){
            senderExistence[i].paths2rootPos[j] <== paths2rootFromPos[i][j];
            senderExistence[i].paths2root[j] <== paths2rootFrom[i][j];
        }

        //nonceFrom[i] != NONCE_MAX_VALUE;
        nonceEquals[i] = IsEqual();
        nonceEquals[i].in[0] <== nonceFrom[i];
        nonceEquals[i].in[1] <== NONCE_MAX_VALUE;
        nonceEquals[i].out === 0;

        //-----CHECK TOKEN TYPES === IF NON-WITHDRAWS-----//
        ifBothHighForceEqual[i] = IfBothHighForceEqual();
        ifBothHighForceEqual[i].check1 <== toX[i];
        ifBothHighForceEqual[i].check2 <== toY[i];
        ifBothHighForceEqual[i].a <== tokenTypeTo[i];
        ifBothHighForceEqual[i].b <== tokenTypeFrom[i];
        //-----END CHECK TOKEN TYPES-----//  


        // subtract amount from sender balance; increase sender nonce 
        newSender[i] = BalanceLeaf();
        newSender[i].x <== fromX[i];
        newSender[i].y <== fromY[i];
        newSender[i].balanceComm[0] <== CERC20TokenFrom[i].newBalance[0];
        newSender[i].balanceComm[1] <== CERC20TokenFrom[i].newBalance[1];
        newSender[i].nonce <== nonceFrom[i] + 1;
        newSender[i].tokenType <== tokenTypeFrom[i];

        // get intermediate root from new sender leaf
        computedRootFromNewSender[i] = GetMerkleRoot(n);
        computedRootFromNewSender[i].leaf <== newSender[i].out;
        for (var j = 0; j < n; j++){
            computedRootFromNewSender[i].paths2root[j] <== paths2rootFrom[i][j];
            computedRootFromNewSender[i].paths2rootPos[j] <== paths2rootFromPos[i][j];
        }

        // check that intermediate root is consistent with input

        computedRootFromNewSender[i].out === intermediateRoots[2*i  + 1];
        //-----END SENDER IN TREE 2 AFTER DEDUCTING CHECK-----//

        // CERC20Token receiver
        CERC20TokenTo[i] = CERC20TokenTo();
        CERC20TokenTo[i].currentBalance[0] <== balanceCommXTo[i];
        CERC20TokenTo[i].currentBalance[1] <== balanceCommYTo[i];
        CERC20TokenTo[i].amount[0] <== amountCommX[i];
        CERC20TokenTo[i].amount[1] <== amountCommY[i];

        // receiver existence check in intermediate root from new sender
        receiverExistence[i] = BalanceExistence(n);
        receiverExistence[i].x <== toX[i];
        receiverExistence[i].y <== toY[i];
        receiverExistence[i].balanceComm[0] <== balanceCommXTo[i];
        receiverExistence[i].balanceComm[1] <== balanceCommYTo[i];
        receiverExistence[i].nonce <== nonceTo[i];
        receiverExistence[i].tokenType <== tokenTypeTo[i];

        receiverExistence[i].balanceRoot <== intermediateRoots[2*i + 1];
        for (var j = 0; j < n; j++){
            receiverExistence[i].paths2rootPos[j] <== paths2rootToPos[i][j] ;
            receiverExistence[i].paths2root[j] <== paths2rootTo[i][j];
        }

        //-----CHECK RECEIVER IN TREE 3 AFTER INCREMENTING-----//
        newReceiver[i] = BalanceLeaf();
        newReceiver[i].x <== toX[i];
        newReceiver[i].y <== toY[i];

        // if receiver is zero address, do not change balance
        // otherwise add amount to receiver balance
        allLow[i] = AllLow(2);
        allLow[i].in[0] <== toX[i];
        allLow[i].in[1] <== toY[i];

        ifThenElse1[i] = IfAThenBElseC();
        ifThenElse1[i].aCond <== allLow[i].out;
        ifThenElse1[i].bBranch <== balanceCommXTo[i];
        ifThenElse1[i].cBranch <== CERC20TokenTo[i].newBalance[0];  

        ifThenElse2[i] = IfAThenBElseC();
        ifThenElse2[i].aCond <== allLow[i].out;
        ifThenElse2[i].bBranch <== balanceCommYTo[i];
        ifThenElse2[i].cBranch <== CERC20TokenTo[i].newBalance[1];  

        newReceiver[i].balanceComm[0] <== ifThenElse1[i].out; 
        newReceiver[i].balanceComm[1] <== ifThenElse2[i].out;
        newReceiver[i].nonce <== nonceTo[i];
        newReceiver[i].tokenType <== tokenTypeTo[i];


        // get intermediate root from new receiver leaf
        computedRootFromNewReceiver[i] = GetMerkleRoot(n);
        computedRootFromNewReceiver[i].leaf <== newReceiver[i].out;
        for (var j = 0; j < n; j++){
            computedRootFromNewReceiver[i].paths2root[j] <== paths2rootTo[i][j];
            computedRootFromNewReceiver[i].paths2rootPos[j] <== paths2rootToPos[i][j];
        }

        // check that intermediate root is consistent with input
        computedRootFromNewReceiver[i].out === intermediateRoots[2*i  + 2];
        //-----END CHECK RECEIVER IN TREE 3 AFTER INCREMENTING-----//
    }
    out <== computedRootFromNewReceiver[2**m - 1].out;
}

component main { public [txRoot, currentState] } = Main(4, 2);