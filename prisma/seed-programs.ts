import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating/updating academic programs...')

  const programs = [
    {
      name: 'BSIT',
      displayName: 'Bachelor of Science in Information Technology',
      description:
        'A program focused on the study of computer systems, networks, and software development.',
    },
    {
      name: 'BSCPE',
      displayName: 'Bachelor of Science in Computer Engineering',
      description:
        'A program that combines principles of electrical engineering and computer science.',
    },
  ]

  for (const program of programs) {
    const result = await prisma.program.upsert({
      where: {
        name: program.name,
      },
      update: {
        displayName: program.displayName,
        description: program.description,
        isActive: true,
      },
      create: {
        name: program.name,
        displayName: program.displayName,
        description: program.description,
        isActive: true,
      },
    })

    console.log(`Program ready: ${result.name} (${result.id})`)
  }

  console.log('BSIT and BSCPE are ready.')
}

main()
  .catch((error) => {
    console.error('Failed to create programs:')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })