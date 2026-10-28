import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { runAgentStoreContract } from './agent.store.contract.ts';

runAgentStoreContract('fake', () => {
  const database = new FakeDatabase();
  return Promise.resolve({ store: database.agent, ensureUser: () => Promise.resolve(), close: () => Promise.resolve() });
});
