import { createCrudHandler } from '../../../../lib/firestoreCrud';
export default createCrudHandler('redeemCodes', { idPrefix: 'RDM', idLength: 8 });
