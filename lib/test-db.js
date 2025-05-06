// test-db.js
import { prisma } from './prisma.js';

async function main() {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: 'hashedpassword', // In reality, this would be hashed
      username: 'testuser',
      playerProfile: {
        create: {
          displayName: 'Test Player',
          playerStats: {
            create: {}
          }
        }
      }
    },
    include: {
      playerProfile: {
        include: {
          playerStats: true
        }
      }
    }
  });
  
  console.log('Created test user:', user);
  
  // Cleanup (remove test user)
  await prisma.user.delete({
    where: {
      id: user.id
    }
  });
  
  console.log('Test user removed');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });