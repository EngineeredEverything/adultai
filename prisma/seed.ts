import { plans } from '../data/Plans.ts'
import { analyzePromptForCategory } from '../lib/category-analyzer.ts'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Initial categories with keywords only
const initialCategories: {
    name: string
    keywords: string[]
}[] = [
        { name: 'Erotic', keywords: ['erotic', 'sensual', 'sexy', 'intimate', 'nude', 'naked', 'provocative', 'revealing', 'lingerie', 'tease'] },
        { name: 'Hardcore', keywords: ['hardcore', 'penetration', 'sex', 'intercourse', 'cum', 'bj', 'blowjob', 'doggy', 'anal', '69', 'fingering'] },
        { name: 'Lesbian', keywords: ['lesbian', 'girl-on-girl', 'female couple', 'two women', 'femdom', 'tribbing', 'sapphic'] },
        { name: 'Gay', keywords: ['gay', 'male couple', 'two men', 'man-on-man', 'yaoi'] },
        { name: 'BDSM', keywords: ['bdsm', 'bondage', 'dominatrix', 'submission', 'slave', 'chains', 'whip', 'gag', 'fetish', 'leather'] },
        { name: 'Solo_Female', keywords: ['solo female', 'masturbation', 'self play', 'dildo', 'vibrator', 'fingering'] },
        { name: 'Solo_Male', keywords: ['solo male', 'jerking', 'masturbating', 'self play', 'stroking'] },
        { name: 'Hentai', keywords: ['hentai', 'anime girl', 'ecchi', 'tentacle', 'doujin', 'anime nude', 'anime sex'] },
        { name: 'Futanari', keywords: ['futanari', 'futa', 'dickgirl', 'shemale', 'transgirl', 'trans'] },
        { name: 'Group', keywords: ['threesome', 'foursome', 'group sex', 'orgy', 'MMF', 'FFM', 'gangbang'] },
        { name: 'Public', keywords: ['public', 'outdoor', 'voyeur', 'exhibitionist', 'public sex'] },
        { name: 'POV', keywords: ['pov', 'point of view', 'first person', 'pov sex', 'pov blowjob'] },
        { name: 'Cosplay', keywords: ['cosplay', 'costume', 'sexy cosplay', 'maid outfit', 'schoolgirl', 'nurse', 'bunny girl'] }
    ]

async function main() {
    console.log("Starting seed process...")

    // ----------------------- CATEGORIES -----------------------

    console.log("Checking and seeding missing categories...")

    await Promise.all(initialCategories.map(async (cat) => {
        const existing = await prisma.category.findUnique({
            where: { name: cat.name },
        })

        if (!existing) {
            await prisma.category.create({
                data: { name: cat.name, keywords: cat.keywords },
            })
            console.log(`Created category: ${cat.name}`)
        } else {
            console.log(`Category already exists: ${cat.name}`)
        }
    }))

    const categories = await prisma.category.findMany()

    console.log("Finding images without categories...")
    const imagesWithoutCategories = await prisma.generatedImage.findMany({
        where: { categoryIds: undefined },
        select: { id: true, prompt: true },
    })

    console.log(`Found ${imagesWithoutCategories.length} images without categories`)

    const totalImages = await prisma.generatedImage.count()
    console.log(`Total images in database: ${totalImages}`)

    const percentage = ((imagesWithoutCategories.length / totalImages) * 100).toFixed(2)
    console.log(`${percentage}% of images have no categories assigned`)

    const batchSize = 5
    let processed = 0
    let categorized = 0

    for (let i = 0; i < imagesWithoutCategories.length; i += batchSize) {
        const batch = imagesWithoutCategories.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imagesWithoutCategories.length / batchSize)} (${batch.length} images)`)

        for (const image of batch) {
            try {
                const categoryName = analyzePromptForCategory(image.prompt, initialCategories)

                if (categoryName) {
                    const category = categories.find((c) => c.name === categoryName)
                    if (category) {
                        await prisma.generatedImage.update({
                            where: { id: image.id },
                            data: {
                                categoryIds: {
                                    push: category.id,
                                },
                            },
                        })
                        categorized++
                    }
                }

                processed++
                await new Promise((resolve) => setTimeout(resolve, 50))
            } catch (error) {
                console.error(`Error processing image ${image.id}:`, error)
            }
        }

        console.log(`Progress: ${processed}/${imagesWithoutCategories.length} processed, ${categorized} categorized`)
    }

    // ----------------------- SUBSCRIPTION PLANS -----------------------

    console.log("Seeding subscription plans...")

    for (const plan of plans) {
        const existing = await prisma.plan.findUnique({ where: { name: plan.name } })

        if (!existing) {
            // Ensure plan features exist first
            const featureRecords = await Promise.all(
                plan.features.map(async (featureName) => {
                    let feature = await prisma.planFeature.findUnique({ where: { name: featureName } })

                    if (!feature) {
                        feature = await prisma.planFeature.create({
                            data: {
                                name: featureName,
                                description: featureName,
                                isEnabled: true,
                            },
                        })
                        console.log(`Created plan feature: ${featureName}`)
                    }

                    return feature
                })
            )

            // Normalize unlimited values to -1
            const nuts = plan.nuts === Number.POSITIVE_INFINITY ? -1 : plan.nuts
            // const imagesPerDay = plan.imagesPerDay === Number.POSITIVE_INFINITY ? -1 : plan.imagesPerDay
            const imagesPerDay = -1 
            const imagesPerGeneration = plan.imagesPerGeneration === Number.POSITIVE_INFINITY ? -1 : plan.imagesPerGeneration


            // Create the plan
            const createdPlan = await prisma.plan.create({
                data: {
                    name: plan.name,
                    description: plan.description,
                    nutsPerMonth: nuts,
                    imagesPerDay,
                    imagesPerGeneration,
                    monthlyPrice: plan.price.monthly,
                    yearlyPrice: plan.price.yearly,
                    isActive: !plan.disabled,
                },
            })
            console.log(`Created plan: ${plan.name}`)

            // Link features to plan
            for (const feature of featureRecords) {
                await prisma.planToPlanFeature.create({
                    data: {
                        planId: createdPlan.id,
                        planFeatureId: feature.id,
                    },
                })
                console.log(`Linked feature "${feature.name}" to plan "${plan.name}"`)
            }
        } else {
            console.log(`Plan already exists: ${plan.name}`)
        }
    }

    console.log("✅ Seed completed successfully")
}

main()
    .catch((e) => {
        console.error('Error during seeding:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
