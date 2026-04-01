import { localize } from '@deriv-com/translations';
import { getContractTypeOptions } from '../../../shared';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.bulk_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase {{ num_trades }} {{ contract_type }} contracts simultaneously', {
                num_trades: '%1',
                contract_type: '%2',
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'NUM_TRADES',
                    check: 'Number',
                },
                {
                    type: 'field_dropdown',
                    name: 'CONTRACT_TYPE',
                    options: [
                        [localize('CALL'), 'CALL'],
                        [localize('PUT'), 'PUT'],
                        [localize('Matches'), 'MATCHES'],
                        [localize('Differs'), 'DIFFERS'],
                    ],
                },
            ],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('This block purchases multiple contracts simultaneously at the same time.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Simultaneous Purchase'),
            description: localize(
                'Use this block to purchase multiple contracts simultaneously at the same time. This is useful for diversification strategies or when you need to open multiple positions instantly.'
            ),
            key_words: localize('bulk, multiple, simultaneous, batch, parallel'),
        };
    },
    onchange(event) {
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) {
            return;
        }

        // Update contract type options based on trade definition
        if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) {
            this.populateContractTypeList(event);
        } else if (event.type === window.Blockly.Events.BLOCK_CHANGE) {
            if (event.name === 'TYPE_LIST' || event.name === 'TRADETYPE_LIST') {
                this.populateContractTypeList(event);
            }
        }
    },
    populateContractTypeList(event) {
        const trade_definition_block = this.workspace.getTradeDefinitionBlock();

        if (trade_definition_block) {
            const trade_type_block = trade_definition_block.getChildByType('trade_definition_tradetype');
            const trade_type = trade_type_block.getFieldValue('TRADETYPE_LIST');
            const contract_type_block = trade_definition_block.getChildByType('trade_definition_contracttype');
            const contract_type = contract_type_block.getFieldValue('TYPE_LIST');
            const contract_type_list = this.getField('CONTRACT_TYPE');
            const current_value = contract_type_list.getValue();
            const contract_type_options = getContractTypeOptions(contract_type, trade_type);

            contract_type_list.updateOptions(contract_type_options, {
                default_value: current_value,
                event_group: event.group,
                should_pretend_empty: true,
            });
        }
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.bulk_purchase = block => {
    const contractType = block.getFieldValue('CONTRACT_TYPE');
    const numTrades =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'NUM_TRADES',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1';

    // Generate code for simultaneous purchases
    const code = `
// Purchase ${numTrades} ${contractType} contracts simultaneously
const simultaneousPurchases = [];
for (let i = 0; i < ${numTrades}; i++) {
    simultaneousPurchases.push(Bot.purchase('${contractType}'));
}

// Execute all purchases at the same time
Promise.all(simultaneousPurchases).then(results => {
    console.log(\`✅ Successfully purchased \${results.length} ${contractType} contracts simultaneously\`);
    results.forEach((result, index) => {
        console.log(\`Contract \${index + 1}:, result);
    });
}).catch(error => {
    console.error('❌ Simultaneous purchase failed:', error);
});
`;

    return code;
};
