const treeHelper = require("./treeHelper.js");
const {utils} = require("ffjavascript");
const {stringifyBigInts} = utils;

module.exports = class Tree {
  constructor(
      _leafNodes
  ) {
    this.leafNodes = _leafNodes
    this.depth = treeHelper.getBase2Log(_leafNodes.length)
    this.innerNodes = this.treeFromLeafNodes()
    this.root = this.innerNodes[0][0]
  }

  updateInnerNodes(leaf, idx, merkle_path) {
    // get position of affected inner nodes
    const depth = merkle_path.length;
    const proofPos = treeHelper.proofPos(idx, depth);
    const affectedPos = treeHelper.getAffectedPos(proofPos);
    // get new values of affected inner nodes and update them
    const affectedInnerNodes = treeHelper.innerNodesFromLeafAndPath(
        leaf, idx, merkle_path
    );

    // update affected inner nodes
    for (let i = 1; i < depth + 1; i++) {
      this.innerNodes[depth - i][affectedPos[i - 1]] = affectedInnerNodes[i - 1]
    }
  }

  treeFromLeafNodes() {
    let tree = Array(this.depth);
    tree[this.depth - 1] = treeHelper.pairwiseHash(this.leafNodes)

    for (let j = this.depth - 2; j >= 0; j--) {
      tree[j] = treeHelper.pairwiseHash(tree[j + 1])
    }
    return tree
  }

  getProof(leafIdx, depth = this.depth) {
    const proofBinaryPos = treeHelper.idxToBinaryPos(leafIdx, depth);
    const proofPos = treeHelper.proofPos(leafIdx, depth);
    let proof = new Array(depth);
    proof[0] = this.leafNodes[proofPos[0]]
    for (let i = 1; i < depth; i++) {
      proof[i] = this.innerNodes[depth - i][proofPos[i]]
    }
    return {
      proof: proof,
      proofPos: proofBinaryPos
    }
  }

  verifyProof(leafHash, idx, proof) {
    const computed_root = treeHelper.rootFromLeafAndPath((leafHash), idx, (proof))
    return stringifyBigInts(this.root) == stringifyBigInts(computed_root);
  }

  findLeafIdxByHash(hash) {
    const index = this.leafNodes.findIndex((leaf) => leaf.hash == hash)
    return index;
  }
}
