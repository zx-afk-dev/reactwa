import { createCrudHandler } from '../../../../lib/firestoreCrud';
export default createCrudHandler('devKeys', { idPrefix: 'DEV', idLength: 12 });
