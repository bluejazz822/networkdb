/**
 * NAT Gateway Routes
 * Handles all NAT Gateway data from multiple cloud providers
 */

import { Router } from 'express';
import NatGateway from '../../models/NatGateway';
import AliNatGateway from '../../models/AliNatGateway';
import AzureNatGateway from '../../models/AzureNatGateway';
import HwcNatGateway from '../../models/HwcNatGateway';
import OciNatGateway from '../../models/OciNatGateway';

const router = Router();

/**
 * GET /api/natgateways - Get all NAT gateways from all cloud providers
 */
router.get('/', async (req, res) => {
  try {
    const { provider, limit = 100, offset = 0 } = req.query;

    let results: any[] = [];

    if (!provider || provider === 'aws') {
      const awsNgws = await NatGateway.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...awsNgws.map(ngw => ({ ...ngw.toJSON(), provider: 'AWS' })));
    }

    if (!provider || provider === 'ali') {
      const aliNgws = await AliNatGateway.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...aliNgws.map(ngw => ({ ...ngw.toJSON(), provider: 'Alibaba Cloud' })));
    }

    if (!provider || provider === 'azure') {
      const azureNgws = await AzureNatGateway.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...azureNgws.map(ngw => ({ ...ngw.toJSON(), provider: 'Azure' })));
    }

    if (!provider || provider === 'hwc') {
      const hwcNgws = await HwcNatGateway.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...hwcNgws.map(ngw => ({ ...ngw.toJSON(), provider: 'Huawei Cloud' })));
    }

    if (!provider || provider === 'oci') {
      const ociNgws = await OciNatGateway.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...ociNgws.map(ngw => ({ ...ngw.toJSON(), provider: 'Oracle Cloud' })));
    }

    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error: any) {
    console.error('Error fetching NAT gateways:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch NAT gateways'
    });
  }
});

/**
 * GET /api/natgateways/:id - Get specific NAT gateway by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    let result: any = null;

    // Try each provider
    if (!provider || provider === 'aws') {
      result = await NatGateway.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'AWS' } });
      }
    }

    if (!provider || provider === 'ali') {
      result = await AliNatGateway.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Alibaba Cloud' } });
      }
    }

    if (!provider || provider === 'azure') {
      result = await AzureNatGateway.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Azure' } });
      }
    }

    if (!provider || provider === 'hwc') {
      result = await HwcNatGateway.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Huawei Cloud' } });
      }
    }

    if (!provider || provider === 'oci') {
      result = await OciNatGateway.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Oracle Cloud' } });
      }
    }

    res.status(404).json({
      success: false,
      error: 'NAT gateway not found'
    });
  } catch (error: any) {
    console.error('Error fetching NAT gateway:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch NAT gateway'
    });
  }
});

export default router;
