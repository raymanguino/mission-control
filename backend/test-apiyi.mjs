import { decomposeProjectIntoTasks } from './src/lib/apiyi.js';

console.log('Testing project decomposition...\n');

const projectName = 'Task Management App';
const description = 'Build a web app with React frontend and Node.js backend for managing tasks with user authentication';

try {
  const tasks = await decomposeProjectIntoTasks(projectName, description);
  console.log('✅ Decomposition successful!');
  console.log('Tasks created:', tasks.length);
  console.log('\nTasks:');
  tasks.forEach((task, i) => {
    console.log(`\n${i + 1}. ${task.title}`);
    console.log(`   Specialization: ${task.specialization}`);
    console.log(`   Complexity: ${task.complexity || 'N/A'}`);
    console.log(`   Description: ${task.description.substring(0, 100)}...`);
  });
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.stack) console.error(error.stack);
}
