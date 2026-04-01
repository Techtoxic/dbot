import { localize } from '@deriv-com/translations';
import { getContractTypeOptions } from '../../../shared';
import { modifyContextMenu } from '../../../utils';

// Custom purchase block that supports optional multi-contract execution
window.Blockly.Blocks.apollo_purchase = {
    init() {
        this.jsonInit(this.definition());
        // Ensure one of this type per statement-stack
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Apollo purchase {{ contract_type }}', { contract_type: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: getContractTypeOptions(),
                },
            ],
            message1: localize('Multiple contracts: {{ multiple }}  Quantity: {{ qty }}', {
                multiple: '%1',
                qty: '%2',
            }),
            args1: [
                {
                    type: 'field_dropdown',
                    name: 'MULTIPLE_CONTRACTS',
                    options: [
                        [localize('false'), 'FALSE'],
                        [localize('true'), 'TRUE'],
                    ],
                },
                {
                    type: 'field_number',
                    name: 'CONTRACT_QUANTITY',
                    value: 1,
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Execute a purchase, optionally placing multiple contracts.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Apollo purchase'),
            description: localize('Purchase one or many contracts at once.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.apollo_purchase = block => {
    const contractType = block.getFieldValue('PURCHASE_LIST');
    const isMultiple = block.getFieldValue('MULTIPLE_CONTRACTS') === 'TRUE';
    let quantity = block.getFieldValue('CONTRACT_QUANTITY');
    if (quantity == null || quantity === '') {
        quantity =
            window.Blockly.JavaScript.javascriptGenerator.valueToCode(
                block,
                'CONTRACT_QUANTITY',
                window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
            ) || '1';
    }

    if (!isMultiple) {
        return `Bot.purchase('${contractType}');\n`;
    }

    // Parallel purchases using Promise.all
    const code = `
// Apollo: Purchase ${quantity} ${contractType} contracts simultaneously
(() => {
    const __qty = Math.max(1, Number(${quantity}) || 1);
    const __purchases = [];
    for (let i = 0; i < __qty; i++) {
        __purchases.push(Bot.purchase('${contractType}'));
    }
    return Promise.all(__purchases)
        .then(results => {
            console.log('Apollo purchase success:', results.length);
            return results;
        })
        .catch(error => {
            console.error('Apollo purchase failed:', error);
            throw error;
        });
})();
`;
    return code;
};


