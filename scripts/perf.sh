CIRCUIT=update_state_verifier
CIRCUIT_DIR=$(cd $(dirname $0);cd ../circuits;pwd)
ZKIT="/home/jsy/blockchain/ieigen/EigenZKit/target/release/zkit"
WORKSPACE=/tmp/zkit_zkzru_update_state
rm -rf $WORKSPACE && mkdir -p $WORKSPACE

POWER=20
SRS=${CIRCUIT_DIR}/setup_2^${POWER}.key
if [ ! -f $SRS ]; then
   curl https://universal-setup.ams3.digitaloceanspaces.com/setup_2^${POWER}.key -o $SRS
fi

cd $CIRCUIT_DIR

echo "1. Compile the circuit"
${ZKIT} compile -i $CIRCUIT.circom --O2=full -o $WORKSPACE
node --max-old-space-size=4096 ${CIRCUIT_DIR}/../scripts/generate_update_state_verifier.js
mv ${CIRCUIT_DIR}/input.json ${WORKSPACE}/update_state_verifier_js/
# cp ${CIRCUIT_DIR}/input.json ${CIRCUIT_DIR}/update_state_verifier_js/

echo "2. Generate witness"
node ${WORKSPACE}/${CIRCUIT}_js/generate_witness.js ${WORKSPACE}/${CIRCUIT}_js/$CIRCUIT.wasm $CIRCUIT_DIR/update_state_verifier_js/input.json $WORKSPACE/witness.wtns

echo "3. Export verification key"
${ZKIT} export_verification_key -s ${SRS}  -c $WORKSPACE/$CIRCUIT.r1cs -v $WORKSPACE/vk.bin

echo "4. prove"
${ZKIT} prove -c $WORKSPACE/$CIRCUIT.r1cs -w $WORKSPACE/witness.wtns -s ${SRS} -b $WORKSPACE/proof.bin

echo "5. Verify the proof"
${ZKIT} verify -p $WORKSPACE/proof.bin -v $WORKSPACE/vk.bin
