/**
 * Course Content Provider for the AGI Tutor RAG pipeline.
 *
 * Supplies course material to be chunked and embedded into the vector
 * store. The default implementation ships with a curated seed dataset so
 * the pipeline works out of the box and tests stay deterministic. The
 * interface is deliberately small so a database-backed provider (e.g.
 * reading published `Content`/`Course` records) can be swapped in without
 * touching the rest of the pipeline.
 */

import logger from '../../utils/logger';
import { DocumentChunk } from './types';

export interface CourseContentProvider {
  getCourseContent(): Promise<DocumentChunk[]>;
}

interface SeedLesson {
  id: string;
  title: string;
  content: string;
}

interface SeedModule {
  id: string;
  title: string;
  lessons: SeedLesson[];
}

interface SeedCourse {
  id: string;
  title: string;
  modules: SeedModule[];
}

const MAX_CHUNK_LENGTH = 1000;
const CHUNK_OVERLAP = 150;

const SEED_COURSES: SeedCourse[] = [
  {
    id: 'course_blockchain_fundamentals',
    title: 'Introduction to Blockchain',
    modules: [
      {
        id: 'mod_what_is_blockchain',
        title: 'What is a Blockchain?',
        lessons: [
          {
            id: 'lesson_distributed_ledger',
            title: 'Distributed Ledgers',
            content:
              'A blockchain is a distributed ledger that records transactions across many computers so that the record cannot be altered retroactively without the alteration of all subsequent blocks and the consensus of the network. Each participant in the network maintains a copy of the ledger, which removes the need for a central authority. Because every node holds the same history, tampering with a single copy is immediately detectable. Blocks are linked using cryptographic hashes: each block contains the hash of the previous block, forming an unbroken chain back to the genesis block.',
          },
          {
            id: 'lesson_consensus',
            title: 'Consensus Mechanisms',
            content:
              'Consensus is the process by which participants in a blockchain network agree on the state of the ledger. Proof of Work requires miners to solve a computationally expensive puzzle before proposing a new block, which makes attacks costly. Proof of Stake instead selects validators based on the amount of cryptocurrency they lock up as collateral, which is far more energy efficient. Consensus ensures that all honest nodes converge on the same canonical chain even when some nodes behave maliciously or the network is partitioned.',
          },
        ],
      },
      {
        id: 'mod_smart_contracts',
        title: 'Smart Contracts',
        lessons: [
          {
            id: 'lesson_smart_contract_basics',
            title: 'Smart Contract Basics',
            content:
              'A smart contract is a program that runs on a blockchain and executes automatically when predetermined conditions are met. Smart contracts enable trustless agreements because the code, not any single party, enforces the terms. They are deterministic: given the same input, every node that executes the contract reaches the same result, which is why contracts are typically written in restricted languages without nondeterministic operations. Common use cases include token transfers, escrow services, decentralized finance, and automated payments.',
          },
          {
            id: 'lesson_gas_and_fees',
            title: 'Gas and Transaction Fees',
            content:
              'Executing a smart contract consumes computational resources, and users pay for those resources in the network currency. On Ethereum this cost is called gas, and the total fee is the gas used multiplied by the gas price. Estimating gas correctly matters: setting the limit too low causes the transaction to fail and revert, while setting it too high wastes funds. Fee markets prioritise transactions that offer higher prices, which is why fees spike during periods of network congestion.',
          },
        ],
      },
    ],
  },
  {
    id: 'course_decentralized_finance',
    title: 'Decentralized Finance (DeFi)',
    modules: [
      {
        id: 'mod_defi_primitives',
        title: 'DeFi Primitives',
        lessons: [
          {
            id: 'lesson_lending',
            title: 'Lending and Borrowing Protocols',
            content:
              'Decentralized lending protocols allow users to deposit assets into a pool and earn interest, or borrow against their collateral without a bank. Borrowers must over-collateralize their positions because the protocol cannot perform credit checks. Interest rates are often determined algorithmically based on the utilization of the pool: when demand for borrowing is high, rates rise to attract more suppliers. If the value of collateral falls below the required ratio, the position can be liquidated to protect lenders.',
          },
          {
            id: 'lesson_amm',
            title: 'Automated Market Makers',
            content:
              'An automated market maker (AMM) is a smart contract that provides liquidity and sets prices using a mathematical formula rather than an order book. The constant product formula, where the product of the quantities of two assets in a pool stays constant, is the most famous example. Trades move the price along the curve, so large trades relative to pool size cause significant slippage. Liquidity providers earn a share of trading fees but also take on impermanent loss when the relative price of the pooled assets changes.',
          },
        ],
      },
    ],
  },
  {
    id: 'course_math_for_cs',
    title: 'Mathematics for Computer Science',
    modules: [
      {
        id: 'mod_discrete_math',
        title: 'Discrete Mathematics',
        lessons: [
          {
            id: 'lesson_graph_theory',
            title: 'Graph Theory',
            content:
              'A graph is a collection of vertices connected by edges, and it is one of the most important structures in computer science. Graphs model networks of all kinds: social connections, roads, the web, and dependency relationships. A tree is a connected graph with no cycles. Breadth-first search explores a graph level by level and finds the shortest path in unweighted graphs, while depth-first search explores as far as possible along each branch before backtracking and is useful for detecting cycles and topological sorting.',
          },
          {
            id: 'lesson_logic',
            title: 'Propositional Logic',
            content:
              'Propositional logic studies statements that are either true or false and the connectives that combine them: conjunction, disjunction, negation, implication, and biconditional. A truth table lists the truth value of a compound statement for every combination of its atomic propositions. Logical equivalence means two statements have identical truth tables. Proof techniques such as modus ponens, proof by contrapositive, and proof by contradiction are fundamental to reasoning about the correctness of algorithms and programs.',
          },
        ],
      },
    ],
  },
];

/**
 * Split long lesson text into overlapping windows so each stored chunk stays
 * within the embedding model's practical context size.
 */
function chunkText(text: string, maxLength: number, overlap: number): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return [cleaned];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + maxLength, cleaned.length);
    if (end < cleaned.length) {
      // Break on a word boundary when possible.
      const boundary = cleaned.lastIndexOf(' ', end);
      if (boundary > start + maxLength / 2) {
        end = boundary;
      }
    }
    chunks.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export class SeedCourseContentProvider implements CourseContentProvider {
  async getCourseContent(): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    for (const course of SEED_COURSES) {
      for (const module of course.modules) {
        chunks.push({
          id: `chunk_${course.id}_${module.id}`,
          courseId: course.id,
          courseTitle: course.title,
          moduleId: module.id,
          moduleTitle: module.title,
          title: `${course.title} — ${module.title}`,
          content: module.title,
          contentType: 'module',
          metadata: { source: 'seed' },
        });

        for (const lesson of module.lessons) {
          const parts = chunkText(
            lesson.content,
            MAX_CHUNK_LENGTH,
            CHUNK_OVERLAP
          );
          parts.forEach((part, index) => {
            chunks.push({
              id: `chunk_${course.id}_${module.id}_${lesson.id}_${index}`,
              courseId: course.id,
              courseTitle: course.title,
              moduleId: module.id,
              moduleTitle: module.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              title: lesson.title,
              content: part,
              contentType: 'lesson',
              metadata: { source: 'seed', part: parts.length > 1 ? index + 1 : undefined },
            });
          });
        }
      }
    }

    logger.info(`Seed content provider produced ${chunks.length} chunks`);
    return chunks;
  }
}

export function getCourseContentProvider(): CourseContentProvider {
  return new SeedCourseContentProvider();
}
