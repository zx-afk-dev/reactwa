import { createCrudHandler } from '../../../../lib/firestoreCrud';
export default createCrudHandler('redeemCodes', {
  idPrefix: (data) => (data.type === 'vip' ? 'VIP' : data.type === 'dev' ? 'DEV' : 'RDM'),
  idLength: 8,
});
