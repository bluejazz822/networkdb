/**
 * VPN Connection Routes
 * Handles all VPN Connection data from multiple cloud providers
 */

import { Router } from 'express';
import VpnConnection from '../../models/VpnConnection';
import AliVpnConnection from '../../models/AliVpnConnection';
import AzureVpnConnection from '../../models/AzureVpnConnection';
import HwcVpnConnection from '../../models/HwcVpnConnection';
import OciVpnConnection from '../../models/OciVpnConnection';

const router = Router();

/**
 * GET /api/vpnconnections - Get all VPN connections from all cloud providers
 */
router.get('/', async (req, res) => {
  try {
    const { provider, limit = 100, offset = 0 } = req.query;

    let results: any[] = [];

    if (!provider || provider === 'aws') {
      const awsVpns = await VpnConnection.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...awsVpns.map(vpn => ({ ...vpn.toJSON(), provider: 'AWS' })));
    }

    if (!provider || provider === 'ali') {
      const aliVpns = await AliVpnConnection.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...aliVpns.map(vpn => ({ ...vpn.toJSON(), provider: 'Alibaba Cloud' })));
    }

    if (!provider || provider === 'azure') {
      const azureVpns = await AzureVpnConnection.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...azureVpns.map(vpn => ({ ...vpn.toJSON(), provider: 'Azure' })));
    }

    if (!provider || provider === 'hwc') {
      const hwcVpns = await HwcVpnConnection.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...hwcVpns.map(vpn => ({ ...vpn.toJSON(), provider: 'Huawei Cloud' })));
    }

    if (!provider || provider === 'oci') {
      const ociVpns = await OciVpnConnection.findAll({
        limit: Number(limit),
        offset: Number(offset)
      });
      results.push(...ociVpns.map(vpn => ({ ...vpn.toJSON(), provider: 'Oracle Cloud' })));
    }

    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error: any) {
    console.error('Error fetching VPN connections:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch VPN connections'
    });
  }
});

/**
 * GET /api/vpnconnections/:id - Get specific VPN connection by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    let result: any = null;

    // Try each provider
    if (!provider || provider === 'aws') {
      result = await VpnConnection.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'AWS' } });
      }
    }

    if (!provider || provider === 'ali') {
      result = await AliVpnConnection.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Alibaba Cloud' } });
      }
    }

    if (!provider || provider === 'azure') {
      result = await AzureVpnConnection.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Azure' } });
      }
    }

    if (!provider || provider === 'hwc') {
      result = await HwcVpnConnection.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Huawei Cloud' } });
      }
    }

    if (!provider || provider === 'oci') {
      result = await OciVpnConnection.findByPk(id);
      if (result) {
        return res.json({ success: true, data: { ...result.toJSON(), provider: 'Oracle Cloud' } });
      }
    }

    res.status(404).json({
      success: false,
      error: 'VPN connection not found'
    });
  } catch (error: any) {
    console.error('Error fetching VPN connection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch VPN connection'
    });
  }
});

export default router;
