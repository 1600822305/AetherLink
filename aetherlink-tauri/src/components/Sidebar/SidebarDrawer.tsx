import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  MessageSquare as ChatIcon,
  Database as StorageIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  width?: number;
}

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// 导航项列表
const mainNavItems = [
  { key: 'home', text: '聊天', icon: <ChatIcon />, path: '/' },
  { key: 'knowledge', text: '知识库', icon: <StorageIcon />, path: '/knowledge' },
  { key: 'settings', text: '设置', icon: <SettingsIcon />, path: '/settings' },
];

/**
 * 侧边栏导航抽屉组件
 */
const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  open,
  onClose,
  width = 240,
}) => {
  const location = useLocation();
  const pathName = location.pathname;

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
        },
      }}
    >
      <DrawerHeader>
        <IconButton onClick={onClose}>
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />

      {/* 主导航 */}
      <List>
        {mainNavItems.map((item) => (
          <ListItem
            key={item.key}
            disablePadding
            component={Link}
            to={item.path}
            sx={{ color: 'inherit', textDecoration: 'none' }}
          >
            <ListItemButton
              selected={
                item.path === '/'
                  ? pathName === '/'
                  : pathName.startsWith(item.path)
              }
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* 可以在这里添加额外的导航区域，如收藏夹等 */}
    </Drawer>
  );
};

export default SidebarDrawer;