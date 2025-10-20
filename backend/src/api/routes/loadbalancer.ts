/**
 * Load Balancer Routes
 * Handles all load balancer data from multiple cloud providers
 */

import { Router } from 'express';
import LoadBalancer from '../../models/LoadBalancer';
import AliLoadBalancer from '../../models/AliLoadBalancer';
import AzureLoadBalancer from '../../models/AzureLoadBalancer';
import HwcLoadBalancer from '../../models/HwcLoadBalancer';
import OciLoadBalancer from '../../models/OciLoadBalancer';

const router = Router();

/**
 * GET /api/loadbalancers - Get all load balancers from all cloud providers
 */
router.get('/', async (req, res) => {
  try {
    const { provider, limit = 100, offset = 0 } = req.query;

    let results: any[] = [];

    if (!provider || provider === 'aws') {
      const awsLbs = await LoadBalancer.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...awsLbs.map(lb => ({ ...lb.toJSON(), provider: 'AWS' })));
    }

    if (!provider || provider === 'ali') {
      const aliLbs = await AliLoadBalancer.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...aliLbs.map(lb => ({ ...lb.toJSON(), provider: 'Alibaba Cloud' })));
    }

    if (!provider || provider === 'azure') {
      const azureLbs = await AzureLoadBalancer.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...azureLbs.map(lb => ({ ...lb.toJSON(), provider: 'Azure' })));
    }

    if (!provider || provider === 'hwc') {
      const hwcLbs = await HwcLoadBalancer.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...hwcLbs.map(lb => ({ ...lb.toJSON(), provider: 'Huawei Cloud' })));
    }

    if (!provider || provider === 'oci') {
      const ociLbs = await OciLoadBalancer.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...ociLbs.map(lb => ({ ...lb.toJSON(), provider: 'Oracle Cloud' })));
    }

    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error: any) {
    console.error('Error fetching load balancers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch load balancers'
    });
  }
});

/**
 * GET /api/loadbalancers/:id - Get specific load balancer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    let result: any = null;

    // Try each provider
    if (!provider || provider === 'aws') {
      result = await LoadBalancer.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'AWS' } });
      }
    }

    if (!provider || provider === 'ali') {
      result = await AliLoadBalancer.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Alibaba Cloud' } });
      }
    }

    if (!provider || provider === 'azure') {
      result = await AzureLoadBalancer.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Azure' } });
      }
    }

    if (!provider || provider === 'hwc') {
      result = await HwcLoadBalancer.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Huawei Cloud' } });
      }
    }

    if (!provider || provider === 'oci') {
      result = await OciLoadBalancer.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Oracle Cloud' } });
      }
    }

    res.status(404).json({
      success: false,
      error: 'Load balancer not found'
    });
  } catch (error: any) {
    console.error('Error fetching load balancer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch load balancer'
    });
  }
});

export default router;
