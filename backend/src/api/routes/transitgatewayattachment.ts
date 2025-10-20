/**
 * Transit Gateway Attachment Routes
 * Handles Transit Gateway Attachment data (AWS only)
 */

import { Router } from 'express';
import TransitGatewayAttachment from '../../models/TransitGatewayAttachment';

const router = Router();

/**
 * GET /api/transitgatewayattachments - Get all Transit Gateway attachments
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const attachments = await TransitGatewayAttachment.findAll({
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: attachments.map(att => ({ ...att.toJSON(), provider: 'AWS' })),
      total: attachments.length
    });
  } catch (error: any) {
    console.error('Error fetching Transit Gateway attachments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Transit Gateway attachments'
    });
  }
});

/**
 * GET /api/transitgatewayattachments/:id - Get specific Transit Gateway attachment by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await TransitGatewayAttachment.findByPk(id);

    if (result) {
      return res.json({
        success: true,
        data: { ...result.toJSON(), provider: 'AWS' }
      });
    }

    res.status(404).json({
      success: false,
      error: 'Transit Gateway attachment not found'
    });
  } catch (error: any) {
    console.error('Error fetching Transit Gateway attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Transit Gateway attachment'
    });
  }
});

export default router;
